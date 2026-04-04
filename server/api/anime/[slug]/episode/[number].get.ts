import { getAllServers } from "../../../../utils/getServers";
import { filterWorkingServers } from "../../../../utils/filter";
import { getCache } from "../../../../utils/cache";

// ======================
// ðŸ”¥ VALIDAR SERVERS
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
// ðŸ”¥ NORMALIZAR OUTPUT
// ======================
function normalizeServers(servers: any[]) {

  return servers.map((s, i) => ({
    name: `server_${i + 1}`,
    embed: s.embed
  }));
}

// ======================
// ðŸ”¥ MAIN
// ======================
export default defineEventHandler(async (event) => {

  setHeader(event, "Access-Control-Allow-Origin", "*");

  if (event.method === "OPTIONS") return "";

  const { slug, number } = getRouterParams(event);
  const { lang } = getQuery(event);

  const language = lang === "latino" ? "latino" : "sub";

  // ======================
  // ðŸ”¥ 1. CACHE REAL (ARREGLADO)
  // ======================
  const cached = await getCache(slug, Number(number), language);

  if (cached && cached.sources) {

    let servers = [
      ...(cached.sources.hls || []).map((url: string) => ({ embed: url })),
      ...(cached.sources.mp4 || []).map((url: string) => ({ embed: url })),
      ...(cached.sources.embed || []).map((url: string) => ({ embed: url }))
    ];

    servers = validateServers(servers);

    if (servers.length) {
      return {
        success: true,
        source: "cache",
        total: servers.length,
        data: {
          slug,
          number: Number(number),
          servers: normalizeServers(servers)
        }
      };
    }
  }

  // ======================
  // ðŸ”¥ 2. SCRAPER
  // ======================
  let servers = await getAllServers({
    slug,
    number: Number(number),
    title: slug,
    lang: language
  });

  servers = validateServers(servers);

  // ======================
  // ðŸ”¥ 3. FALLBACK LATINO â†’ SUB
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

  // ======================
  // ðŸ”¥ 4. RESPUESTA FINAL
  // ======================
  return {
    success: true,
    source: "scraper",
    total: servers.length,
    data: {
      slug,
      number: Number(number),
      servers: normalizeServers(servers)
    }
  };
});
