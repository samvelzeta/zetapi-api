import { getLatinoSource } from "../../../utils/r2";
import { getAllServers } from "../../../../utils/getServers";
import { filterWorkingServers } from "../../../../utils/filter";
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
// 🔥 NORMALIZAR OUTPUT
// ======================
function normalizeServers(servers: any[]) {

  return servers.map((s, i) => ({
    name: s.name || `server_${i + 1}`,
    embed: s.embed,
    type: s.type || "embed"
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

  const episode = Number(number);
  const language = lang === "latino" ? "latino" : "sub";

  // ======================
  // 🔥 1. CACHE REAL
  // ======================
  const cached = await getCache(slug, episode, language);

  if (cached && cached.sources) {

    let servers = [
      ...(cached.sources.hls || []).map((url: string) => ({
        name: "Latino",
        embed: url,
        type: "hls"
      })),
      ...(cached.sources.mp4 || []).map((url: string) => ({
        embed: url
      })),
      ...(cached.sources.embed || []).map((url: string) => ({
        embed: url
      }))
    ];

    servers = validateServers(servers);

    // ======================
    // 🔥 R2 LATINO (PRIORIDAD)
    // ======================
    let latino = null;

    try {
      latino = await getLatinoSource(slug, episode);
    } catch {}

    if (latino) {
      servers.unshift({
        name: "Latino R2",
        embed: latino,
        type: "hls"
      });
    }

    if (servers.length) {
      return {
        success: true,
        source: "cache",
        total: servers.length,
        data: {
          slug,
          number: episode,
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
    number: episode,
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
      number: episode,
      title: slug,
      lang: "sub"
    });

    servers = validateServers(servers);
  }

  // ======================
  // 🔥 R2 LATINO (PRIORIDAD GLOBAL)
  // ======================
  let latino = null;

  try {
    latino = await getLatinoSource(slug, episode);
  } catch {}

  if (latino) {
    servers.unshift({
      name: "Latino R2",
      embed: latino,
      type: "hls"
    });
  }

  // ======================
  // 🔥 4. RESPUESTA FINAL
  // ======================
  return {
    success: true,
    source: "scraper",
    total: servers.length,
    data: {
      slug,
      number: episode,
      servers: normalizeServers(servers)
    }
  };
});
