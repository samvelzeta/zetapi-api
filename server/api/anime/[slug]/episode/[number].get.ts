import { getAllServers } from "../../../../utils/getServers";
import { getCache, saveCache } from "../../../../utils/cache";

// ======================
async function validateServers(
  servers: any[],
  slug: string,
  number: number
) {

  let clean = servers.filter(s => {

    if (!s?.embed) return false;

    const url = s.embed.toLowerCase();

    if (
      url.includes("error") ||
      url.includes("blank") ||
      url.length < 20
    ) return false;

    return true;
  });

  // 🔥 mínimo 3
  if (clean.length < 3) {

    const extra = await getAllServers({
      slug,
      number,
      title: slug,
      lang: "sub"
    });

    clean = [...clean, ...extra];
  }

  // 🔥 quitar duplicados
  const seen = new Set();

  return clean.filter(s => {
    const u = s.embed.split("?")[0];
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  }).slice(0, 6);
}

// ======================
function normalizeServers(servers: any[]) {
  return servers.map((s, i) => ({
    name: `server_${i + 1}`,
    embed: s.embed,
    type: s.embed.includes(".m3u8") ? "hls" : "embed"
  }));
}

// ======================
export default defineEventHandler(async (event) => {

  setHeader(event, "Access-Control-Allow-Origin", "*");

  const { slug, number } = getRouterParams(event);

  // ======================
  // 🔥 CACHE
  // ======================
  const cached = await getCache(slug, Number(number), "sub");

  if (cached?.sources) {

    let servers = [
      ...(cached.sources.hls || []).map((u: string) => ({ embed: u })),
      ...(cached.sources.mp4 || []).map((u: string) => ({ embed: u })),
      ...(cached.sources.embed || []).map((u: string) => ({ embed: u }))
    ];

    servers = await validateServers(servers, slug, Number(number));

    if (servers.length) {
      return {
        success: true,
        source: "cache",
        total: servers.length,
        data: {
          slug,
          number,
          servers: normalizeServers(servers)
        }
      };
    }
  }

  // ======================
  // 🔥 SCRAPER
  // ======================
  let servers = await getAllServers({
    slug,
    number: Number(number),
    title: slug,
    lang: "sub"
  });

  servers = await validateServers(servers, slug, Number(number));

  // ======================
  // 🔥 SAVE CACHE
  // ======================
  if (servers.length) {
    saveCache(slug, Number(number), "sub", servers);
  }

  return {
    success: true,
    source: "scraper",
    total: servers.length,
    data: {
      slug,
      number,
      servers: normalizeServers(servers)
    }
  };
});
