import { getAllServers } from "../../../../utils/getServers";
import { getCache, saveCache } from "../../../../utils/cache";
import { getLatinoSource } from "../../../../utils/r2";

// ======================
// 🔥 VALIDAR SERVERS
// ======================
function validateServers(servers: any[]) {

  if (servers.length < 3) {

  const extra = await getAllServers({
    slug,
    number: Number(number),
    title: slug,
    lang: "sub"
  });

  servers = uniqueServers([
    ...servers,
    ...extra
  ]).slice(0, 6);
}

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
// 🔥 ELIMINAR DUPLICADOS
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
// 🔥 NORMALIZAR OUTPUT
// ======================
function normalizeServers(servers: any[]) {

  return servers.map((s, i) => ({
    name: `server_${i + 1}`,
    embed: s.embed,
    type: s.embed.includes(".m3u8") ? "hls" : "embed"
  }));
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
  // 🔥 0. R2 (NO BLOQUEANTE)
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
  // 🔥 1. CACHE
  // ======================
  const cached = await getCache(slug, Number(number), language);

  if (cached && cached.sources) {

    let servers = [
      ...(cached.sources.hls || []).map((url: string) => ({ embed: url })),
      ...(cached.sources.mp4 || []).map((url: string) => ({ embed: url })),
      ...(cached.sources.embed || []).map((url: string) => ({ embed: url }))
    ];

    servers = validateServers(servers);
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
  // 🔥 2. SCRAPER
  // ======================
  let servers = await getAllServers({
    slug,
    number: Number(number),
    title: slug,
    lang: language
  });

  servers = validateServers(servers);
  servers = uniqueServers(servers);

  // ======================
  // 🔥 ASEGURAR MÍNIMO 3 SERVERS
  // ======================
  if (servers.length > 0 && servers.length < 3) {

    const extra = await getAllServers({
      slug,
      number: Number(number),
      title: slug,
      lang: "sub"
    });

    const merged = [...servers, ...extra];

    servers = uniqueServers(validateServers(merged));
  }

  // ======================
  // 🔥 GUARDAR CACHE
  // ======================
  if (servers.length) {
    saveCache(slug, Number(number), language, servers);
  }

  // ======================
  // 🔥 FALLBACK FINAL
  // ======================
  if (!servers.length) {
    return {
      success: true,
      source: "empty",
      total: 0,
      data: {
        slug,
        number: Number(number),
        servers: []
      }
    };
  }

  // ======================
  // 🔥 RESPUESTA FINAL
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
