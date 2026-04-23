import { getAV1ServersFast, getAllServers } from "../../../../utils/getServers";
import { getKVVideo, saveKVVideo } from "../../../../utils/kv";

export default defineEventHandler(async (event) => {
  try {
    setHeader(event, "Access-Control-Allow-Origin", "*");

    const { slug, number } = getRouterParams(event);
    const { lang, force, progressive } = getQuery(event) as { lang?: string, force?: string, progressive?: string };

    const language = lang === "latino" ? "latino" : "sub";
    const forceRefresh = force === "1" || force === "true";
    const progressiveMode = progressive !== "0" && progressive !== "false";
    const ep = Number(number);

    // 🔥 ENV SEGURO (FIX REAL KV)
    const env
      = event.context.cloudflare?.env
        || (globalThis as any);

    // ======================
    // 🔥 DEBUG (BORRAR LUEGO SI QUIERES)
    // ======================
    console.info("ENV OK:", !!env);
    console.info("KV OK:", !!env?.ANIME_CACHE);

    // ======================
    // 🔥 1. INTENTAR KV
    // ======================
    if (!forceRefresh) {
      try {
        const cached = await getKVVideo(slug, ep, language, env);

        if (cached?.sources) {
          const servers = [
            ...(cached.sources.hls || []),
            ...(cached.sources.mp4 || []),
            ...(cached.sources.embed || [])
          ].map((u: string) => ({ embed: u }));

          if (servers.length) {
            console.info("⚡ SERVIDO DESDE KV");

            return {
              success: true,
              source: "kv",
              data: { slug, number: ep, servers }
            };
          }
        }
      }
      catch (e) {
        console.error("❌ KV READ ERROR:", e);
      }
    }
    else {
      console.info("🧪 FORCE=1 → saltando KV y rescrapeando");
    }

    const fullScrapeAndPersist = async () => {
      const fullServers = await getAllServers({
        slug,
        number: ep,
        title: slug,
        env,
        language
      });

      console.info("SCRAPER SERVERS:", fullServers.length);

      if (fullServers.length) {
        try {
          const payload = {
            sources: {
              embed: fullServers.map(s => s.embed)
            }
          };

          await saveKVVideo(
            slug,
            ep,
            language,
            payload,
            env
          );

          console.info("💾 KV GUARDADO:", `${slug}:${ep}:${language}`);
        }
        catch (e) {
          console.error("❌ KV SAVE ERROR:", e);
        }
      }

      return fullServers;
    };

    // ======================
    // 🔥 2. SCRAPER (MODO PROGRESIVO)
    // ======================
    if (progressiveMode) {
      const av1Servers = await getAV1ServersFast({
        slug,
        number: ep,
        title: slug
      });

      console.info("AV1 FAST SERVERS:", av1Servers.length);

      if (av1Servers.length) {
        const waitUntilFn = event.context.cloudflare?.context?.waitUntil;
        const backgroundJob = fullScrapeAndPersist()
          .catch((err) => {
            console.error("❌ BACKGROUND SCRAPE ERROR:", err);
            return [];
          });

        if (typeof waitUntilFn === "function") {
          waitUntilFn(backgroundJob);
        }
        else {
          // fallback seguro: disparar sin bloquear si waitUntil no existe
          void backgroundJob;
        }

        return {
          success: true,
          source: forceRefresh ? "scraper-av1-fast-forced" : "scraper-av1-fast",
          data: { slug, number: ep, servers: av1Servers }
        };
      }
    }

    // ======================
    // 🔥 3. SCRAPER COMPLETO (SYNC)
    // ======================
    const servers = await fullScrapeAndPersist();

    if (servers.length) {
      return {
        success: true,
        source: forceRefresh ? "scraper-forced" : "scraper",
        data: { slug, number: ep, servers }
      };
    }

    // ======================
    // 🔥 4. VACÍO
    // ======================
    console.warn("⚠️ SIN SERVERS");

    return {
      success: true,
      source: "empty",
      data: { slug, number: ep, servers: [] }
    };
  }
  catch (e: any) {
    console.error("❌ EPISODE HANDLER ERROR:", e);
    return {
      success: true,
      source: "error-fallback",
      data: { slug: null, number: null, servers: [] },
      error: "scraping_failed"
    };
  }
});
