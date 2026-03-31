import { getAllServers } from "../../../../utils/getServers";

// ======================
// 🔥 CACHE CONFIG
// ======================
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 horas

// ======================
// 🔥 CACHE FETCH
// ======================
async function getCache(slug: string, number: number, lang: string) {

  try {

    const url = `https://raw.githubusercontent.com/samvelzeta/zetanime-cache/main/data/${slug}/${number}-${lang}.json`;

    const res = await fetch(url);

    if (!res.ok) return null;

    const json = await res.json();

    // 🔥 validar expiración
    if (Date.now() - json.updated > CACHE_TTL) {
      return null;
    }

    // 🔥 validar contenido
    if (!json?.sources?.length) return null;

    return json;

  } catch {
    return null;
  }
}

// ======================
// 🔥 VALIDAR SERVERS
// ======================
function validateServers(servers: any[]) {

  if (!servers?.length) return [];

  return servers.filter(s => {

    if (!s?.embed) return false;

    const url = s.embed.toLowerCase();

    // 🔥 evitar basura
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
  // 🔥 INTENTAR CACHE
  // ======================
  const cached = await getCache(slug, number, language);

  if (cached) {
    return {
      success: true,
      cached: true,
      total: cached.sources.length,
      data: cached
    };
  }

  // ======================
  // 🔥 SCRAPING
  // ======================
  let servers = await getAllServers({
    slug,
    number: Number(number),
    title: slug,
    lang: language
  });

  servers = validateServers(servers);

  // ======================
  // 🔥 FALLBACK (IMPORTANTE)
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
    cached: false,
    total: servers.length,
    data: {
      slug,
      number: Number(number),
      servers
    }
  };
});
