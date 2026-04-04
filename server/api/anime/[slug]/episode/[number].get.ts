// server/api/anime/episode/[slug]/[number].get.ts

import { getAllServers } from "../../../../utils/getServers";
import { getCache } from "../../../../utils/cache";
import { getOverride } from "../../../../utils/override";
import { saveCache } from "../../../../utils/saveCache";
import { scrapePage } from "../../../../utils/sources"; // usa tu scraper base

export default defineEventHandler(async (event) => {

  setHeader(event, "Access-Control-Allow-Origin", "*");

  const { slug, number } = getRouterParams(event);
  const { lang } = getQuery(event);

  const language = lang === "latino" ? "latino" : "sub";

  // ======================
  // 🧠 1. CACHE
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
  // 🧠 2. OVERRIDE (🔥 CLAVE)
  // ======================
  const override = await getOverride(slug);

  if (override) {

    const servers = await scrapePage(`${override}/${number}`);

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
  // 🔥 3. SCRAPER NORMAL
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
