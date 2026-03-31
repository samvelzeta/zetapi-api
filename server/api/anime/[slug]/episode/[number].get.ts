import { getAllServers } from "../../../../utils/getServers";
import { getCache } from "../../../../utils/cache";

// ======================
// 🔥 VALIDAR SERVERS
// ======================
function validateServers(servers: any[]) {

  if (!servers?.length) return [];

  return servers.filter(s => {

    if (!s?.embed) return false;

    const url = s.embed.toLowerCase();

    if (
      url.includes("error") ||
      url.includes("blank") ||
      url.length < 20
    ) return false;

    return true;
  });
}

// ======================
// 🔥 MAIN
// ======================
export default defineEventHandler(async (event) => {

  setHeader(event, "Access-Control-Allow-Origin", "*");

  if (event.method === "OPTIONS") return "";

  const { slug, number } = getRouterParams(event);
  const { lang } = getQuery(event);

  const language = lang === "latino" ? "latino" : "sub";

  // ======================
  // 🔥 1. CACHE (PRIORIDAD TOTAL)
  // ======================
  const cached = await getCache(slug, Number(number), language);

  if (cached && cached.sources) {

    const servers = [
      ...(cached.sources.hls || []).map((url: string) => ({
        name: "cache-hls",
        embed: url
      })),
      ...(cached.sources.mp4 || []).map((url: string) => ({
        name: "cache-mp4",
        embed: url
      })),
      ...(cached.sources.embed || []).map((url: string) => ({
        name: "cache-embed",
        embed: url
      }))
    ];

    if (servers.length) {
      return {
        success: true,
        source: "cache",
        total: servers.length,
        data: {
          slug,
          number: Number(number),
          servers
        }
      };
    }
  }

  // ======================
  // 🔥 2. SCRAPER NORMAL
  // ======================
  let servers = await getAllServers({
    slug,
    number: Number(number),
    title: slug,
    lang: language
  });

  servers = validateServers(servers);

  // ======================
  // 🔥 3. FALLBACK LATINO → SUB
  // ======================
  if (!servers.length && language === "latino") {

    servers = await getAllServers({
      slug,
      number: Number(number),
      title: slug,
      lang: "sub"
    });

    servers = validateServers(servers);
  }

  return {
    success: true,
    source: "scraper",
    total: servers.length,
    data: {
      slug,
      number: Number(number),
      servers
    }
  };
});
