import {
  getAnimeFLVServers,
  getJKAnimeServers,
  getLatanimeServers,
  getTioAnimeServers,
  getAnimeIDServers,
  getAnimeYTServers,
  getAnimeFenixServers
} from "./sources";

import { filterWorkingServers } from "./filter";
import { expandSlugVariants } from "./slugResolver";

// ======================
// 🔥 SCORE DE SERVIDORES
// ======================
function scoreServer(server: any) {

  const url = (server.embed || "").toLowerCase();

  let score = 0;

  // 🥇 DIRECTOS (TOP)
  if (url.includes(".m3u8")) score += 100;
  if (url.includes(".mp4")) score += 90;

  // 🥈 SERVERS LIMPIOS
  if (url.includes("filemoon")) score += 80;
  if (url.includes("streamtape")) score += 75;
  if (url.includes("ok.ru")) score += 70;

  // 🥉 JKAnime (muy bueno)
  if (server.name === "jkanime") score += 85;

  // 🔻 STREAMWISH (ÚLTIMO SIEMPRE)
  if (url.includes("streamwish")) score -= 50;

  return score;
}

// ======================
// 🔥 ORDEN FINAL
// ======================
function sortServers(servers: any[]) {
  return servers.sort((a, b) => scoreServer(b) - scoreServer(a));
}

// ======================
// 🔥 PIPELINE GLOBAL
// ======================
async function processServers(raw: any[]) {

  if (!raw?.length) return [];

  // 🔥 eliminar duplicados
  const unique = Array.from(
    new Map(raw.map(s => [s.embed, s])).values()
  );

  // 🔥 filtro base
  const filtered = await filterWorkingServers(unique);

  // 🔥 ordenar por calidad
  const sorted = sortServers(filtered);

  return sorted;
}

// ======================
// 🔥 MAIN
// ======================
export async function getAllServers({
  slug,
  number,
  title,
  lang
}: any) {

  let servers: any[] = [];

  const safeTitle = title || slug;

  // =====================
  // 🔥 SUB (RÁPIDO Y DIRECTO)
  // =====================
  if (lang === "sub") {

    const [jk, flv] = await Promise.all([
      getJKAnimeServers(slug, number),
      getAnimeFLVServers(slug, number)
    ]);

    servers = [...jk, ...flv];

    return await processServers(servers);
  }

  // =====================
  // 🔥 LATINO (INTELIGENTE)
  // =====================
  if (lang === "latino") {

    const variants = expandSlugVariants(safeTitle).slice(0, 15);

    for (const v of variants) {

      const results = await Promise.all([

        // 🥇 PRIORIDAD LATINO REAL
        getLatanimeServers(v, number),

        // 🥈 FUENTES PRINCIPALES
        getTioAnimeServers(v, number),
        getAnimeYTServers(v, number),
        getAnimeFenixServers(v, number),

        // 🥉 APOYO
        getAnimeIDServers(v, number)
      ]);

      const flat = results.flat().filter(Boolean);

      if (flat.length) {

        servers.push(...flat);

        // 🔥 corte temprano inteligente
        if (flat.length >= 3) break;
      }
    }

    // =====================
    // 🔥 FALLBACK LATINO → SUB
    // =====================
    if (!servers.length) {

      const [jk, flv] = await Promise.all([
        getJKAnimeServers(slug, number),
        getAnimeFLVServers(slug, number)
      ]);

      servers = [...jk, ...flv];
    }

    return await processServers(servers);
  }

  return [];
}
