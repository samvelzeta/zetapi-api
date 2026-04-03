import { getAllServers } from "../../../../utils/getServers";
import { getCache, saveCache } from "../../../../utils/cache";
import { getLatinoSource } from "../../../../utils/r2";

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

  // 🔥 asegurar mínimo 3
  if (clean.length < 3) {

    const extra = await getAllServers({
      slug,
      number,
      title: slug,
      lang: "sub"
    });

    clean = uniqueServers([...clean, ...extra]).slice(0, 6);
  }

  return clean;
}

// ======================
function uniqueServers(servers: any[]) {

  const seen = new Set();
  const clean = [];

  for (const s of servers) {

    const url = s.embed?.split("?")[0];

    if (!seen.has(url)) {
      seen.add(url);
      clean.push(s);
    }
  }

  return clean;
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

  if (event.method === "OPTIONS") return "";

  const { slug, number } = getRouterParams(event);
  const { lang } = getQuery(event);

  const language = lang === "latino" ? "latino" : "sub";

  // ======================
  // 🔥 R2
  // ======================
  try {

    const r2Promise = getLatinoSource(slug, Number(number));

    const timeout = new Promise(resolve =>
      setTimeout(() => resolve(null), 1500)
    );

    const r2Url = await Promise.race([r2Promise, timeout]) as string | null;

    if (r2Url) {
      return {
        success: true,
        source: "r2",
        total: 1,
        data: {
          slug,
          number: Number(number),
          servers: [
            {
              name: "r2_hls",
              embed: r2Url,
              type: "hls"
            }
          ]
        }
      };
    }

  } catch {}

  // ======================
  // 🔥 CACHE
  // ======================
  const cached = await getCache(slug, Number(number), language);

  if (cached && cached.sources) {

    let servers = [
      ...(cached.sources.hls || []).map((url: string) => ({ embed: url })),
      ...(cached.sources.mp4 || []).map((url: string) => ({ embed: url })),
      ...(cached.sources.embed || []).map((url: string) => ({ embed: url }))
    ];

    servers = await validateServers(servers, slug, Number(number));
    servers = uniqueServers(servers);

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
  // 🔥 SCRAPER
  // ======================
  let servers = await getAllServers({
    slug,
    number: Number(number),
    title: slug,
    lang: language
  });

  servers = await validateServers(servers, slug, Number(number));
  servers = uniqueServers(servers);

  // ======================
  // 🔥 CACHE SAVE
  // ======================
  if (servers.length) {
    saveCache(slug, Number(number), language, servers);
  }

  // ======================
  // 🔥 RESPUESTA FINAL
  // ======================
  return {
    success: true,
    source: servers.length ? "scraper" : "empty",
    total: servers.length,
    data: {
      slug,
      number: Number(number),
      servers: normalizeServers(servers)
    }
  };
});
