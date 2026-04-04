import { getAllServers } from "../../../../utils/getServers";
import { getCache } from "../../../../utils/cache";
import { getOverride } from "../../../../utils/override";
import { saveCache } from "../../../../utils/saveCache";
import { scrapePage } from "../../../../utils/sources";

export default defineEventHandler(async (event) => {

  setHeader(event, "Access-Control-Allow-Origin", "*");

  const { slug, number } = getRouterParams(event);
  const { lang } = getQuery(event);

  const language = lang === "latino" ? "latino" : "sub";

  // ======================
  // 🧠 CACHE
  // ======================
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
  // 🔥 OVERRIDE
  // ======================
 const override = await getOverride(slug);

if (override) {

  let url = override;

  // 🔥 FIX AUTOMÁTICO
  if (!url.endsWith("/")) url += "/";
  if (!url.match(/\/\d+\/$/)) {
    url += `${number}/`;
  }

  const servers = await scrapePage(url);

  if (servers.length) {

    await saveCache(slug, Number(number), language, servers);

    return {
      success: true,
      source: "override",
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
    lang: language
  });

  if (servers.length) {

    await saveCache(slug, Number(number), language, servers);

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
