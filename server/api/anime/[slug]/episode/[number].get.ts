import { getAllServers } from "../../../../utils/getServers";
import { getCache } from "../../../../utils/cache";
import { saveCache } from "../../../../utils/saveCache";

export default defineEventHandler(async (event) => {

  setHeader(event, "Access-Control-Allow-Origin", "*");

  const { slug, number } = getRouterParams(event);
  const { lang } = getQuery(event);

  const language = lang === "latino" ? "latino" : "sub";

  const cached = await getCache(slug, Number(number), language);

  if (cached?.sources) {

    const servers = [
      ...(cached.sources.hls || []),
      ...(cached.sources.mp4 || []),
      ...(cached.sources.embed || [])
    ].map((u: string) => ({ embed: u }));

    if (servers.length) {
      return {
        success: true,
        source: "cache",
        data: { slug, number, servers }
      };
    }
  }

  // ======================
  // 🔥 SCRAPER
  // ======================
 const servers = await getAllServers({
  slug,
  number: Number(number),
  title: slug,
  env: event.context.cloudflare?.env,
  lang: language
});

  if (servers.length) {

    await saveCache(
  slug,
  Number(number),
  language,
  servers,
  event.context.cloudflare?.env
);

    return {
      success: true,
      source: "scraper",
      data: { slug, number, servers }
    };
  }

  return {
    success: true,
    source: "empty",
    data: { slug, number, servers: [] }
  };
});
