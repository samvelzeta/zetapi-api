import { getAllServers } from "../../../../utils/getServers";
import { getKVVideo, saveKVVideo } from "../../../../utils/kv";

export default defineEventHandler(async (event) => {

  setHeader(event, "Access-Control-Allow-Origin", "*");

  const { slug, number } = getRouterParams(event);
  const { lang } = getQuery(event);

  const language = lang === "latino" ? "latino" : "sub";
  const ep = Number(number);

  const env =
    event.context.cloudflare?.env ||
    (globalThis as any);

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
          data: {
            slug,
            number: ep,
            servers,
            subtitles: cached.subtitles || [] // 🔥 FIX
          }
        };
      }
    }

  } catch (e) {
    console.log("❌ KV READ ERROR:", e);
  }

  // ======================
  // 🔥 2. SCRAPER SERVERS
  // ======================
  const servers = await getAllServers({
    slug,
    number: ep,
    title: slug,
    env
  });

  console.log("SCRAPER SERVERS:", servers.length);

  // ======================
  // 🔥 2.5 EXTRAER SUBTÍTULOS (BOT)
  // ======================
  let subtitles: any[] = [];

  try {
    const BOT_URL = "https://a24785-ef25.xs001.jrnm.app/extraer";

    const res = await fetch(BOT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `https://latino.solo-latino.com/es/detail/drama/${slug}`,
        ep
      })
    });

    if (res.ok) {
      const data = await res.json();

      subtitles = data.subtitles || data.subtitulos || [];

      console.log("🎯 SUBS DETECTADOS:", subtitles.length);
    }

  } catch (e) {
    console.log("⚠️ SUBS BOT ERROR:", e);
  }

  // ======================
  // 🔥 3. GUARDAR EN KV
  // ======================
  if (servers.length) {

    try {

      const payload = {
        sources: {
          embed: servers.map(s => s.embed)
        },
        subtitles // 🔥 FIX
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
      data: {
        slug,
        number: ep,
        servers,
        subtitles // 🔥 FIX FINAL
      }
    };
  }

  // ======================
  // 🔥 4. VACÍO
  // ======================
  console.log("⚠️ SIN SERVERS");

  return {
    success: true,
    source: "empty",
    data: {
      slug,
      number: ep,
      servers: [],
      subtitles: [] // 🔥 FIX
    }
  };
});
