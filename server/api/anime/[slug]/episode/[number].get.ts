import { getAllServers } from "../../../../utils/getServers";
import { getKVVideo, saveKVVideo } from "../../../../utils/kv";

export default defineEventHandler(async (event) => {

  setHeader(event, "Access-Control-Allow-Origin", "*");

  const { slug, number } = getRouterParams(event);
  const { lang } = getQuery(event);

  const language = lang === "latino" ? "latino" : "sub";
  const ep = Number(number);

  // 🔥 ENV SEGURO (FIX REAL KV)
  const env =
    event.context.cloudflare?.env ||
    (globalThis as any);

  // ======================
  // 🔥 DEBUG (BORRAR LUEGO SI QUIERES)
  // ======================
  console.log("ENV OK:", !!env);
  console.log("KV OK:", !!env?.ANIME_CACHE);

  // ======================
  // 🔥 1. INTENTAR KV
  // ======================
  try {

    const cached = await getKVVideo(slug, ep, language, env);

    if (cached?.sources) {

      const servers = [
        ...(cached.sources.hls || []),
        ...(cached.sources.mp4 || []),
        ...(cached.sources.embed || [])
      ].map((u: string) => ({ embed: u }));

      if (servers.length) {
        console.log("⚡ SERVIDO DESDE KV");

        return {
          success: true,
          source: "kv",
          data: { slug, number: ep, servers }
        };
      }
    }

  } catch (e) {
    console.log("❌ KV READ ERROR:", e);
  }

  // ======================
  // 🔥 2. SCRAPER
  // ======================
  const servers = await getAllServers({
    slug,
    number: ep,
    title: slug,
    env
  });

  console.log("SCRAPER SERVERS:", servers.length);

  // ======================
  // 🔥 3. GUARDAR EN KV
  // ======================
  if (servers.length) {

    try {

      const payload = {
        sources: {
          embed: servers.map(s => s.embed)
        }
      };

      await saveKVVideo(
        slug,
        ep,
        language,
        payload,
        env
      );

      console.log("💾 KV GUARDADO:", `${slug}:${ep}:${language}`);

    } catch (e) {
      console.log("❌ KV SAVE ERROR:", e);
    }

    return {
      success: true,
      source: "scraper",
      data: { slug, number: ep, servers }
    };
  }

  // ======================
  // 🔥 4. VACÍO
  // ======================
  console.log("⚠️ SIN SERVERS");

  return {
    success: true,
    source: "empty",
    data: { slug, number: ep, servers: [] }
  };
});
