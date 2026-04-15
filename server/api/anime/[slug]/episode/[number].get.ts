import { getAllServers } from "../../../../utils/getServers";
import { getKVVideo, saveKVVideo } from "../../../../utils/kv";

export default defineEventHandler(async (event) => {

  setHeader(event, "Access-Control-Allow-Origin", "*");

  const { slug, number } = getRouterParams(event);
  const { lang } = getQuery(event);

  const language = lang === "latino" ? "latino" : "sub";
  const ep = Number(number);

  const env = event.context.cloudflare?.env;

  // ======================
  // 🔥 KV
  // ======================
  const cached = await getKVVideo(slug, ep, language, env);

  if (cached?.sources) {

    const servers = [
      ...(cached.sources.hls || []),
      ...(cached.sources.mp4 || []),
      ...(cached.sources.embed || [])
    ].map((u: string) => ({ embed: u }));

    if (servers.length) {
      return {
        success: true,
        source: "kv",
        data: { slug, number: ep, servers }
      };
    }
  }

  // ======================
  // 🔥 SCRAPER
  // ======================
  const servers = await getAllServers({
    slug,
    number: ep,
    title: slug,
    env
  });

  // ======================
  // 🔥 GUARDAR KV
  // ======================
  if (servers.length) {

    try {

      await saveKVVideo(
        slug,
        ep,
        language,
        {
          sources: {
            embed: servers.map(s => s.embed)
          }
        },
        env
      );

      console.log("💾 KV GUARDADO");

    } catch (e) {
      console.log("❌ KV ERROR:", e);
    }

    return {
      success: true,
      source: "scraper",
      data: { slug, number: ep, servers }
    };
  }

  return {
    success: true,
    source: "empty",
    data: { slug, number: ep, servers: [] }
  };
});
