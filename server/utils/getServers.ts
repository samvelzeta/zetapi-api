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

// ======================
// 🧠 NORMALIZADOR PRO
// ======================
function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[:\-]/g, " ")
    .replace(/\b(season|temporada|part|parte|capitulo|episode)\b/g, "")
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ======================
// 🧠 EXPANSIÓN INTELIGENTE
// ======================
function expandTitle(title: string) {

  const base = normalizeTitle(title);
  const variants = new Set<string>();

  variants.add(base);
  variants.add(base.replace(/ /g, "-"));
  variants.add(base.replace(/ /g, ""));
  variants.add(base.replace(/ /g, "_"));

  variants.add(base + " anime");
  variants.add(base + " online");
  variants.add(base + " latino");
  variants.add(base + " sub");
  variants.add(base + " castellano");
  variants.add(base + " hd");

  variants.add(base.replace("the", ""));
  variants.add(base.replace("no", ""));
  variants.add(base.replace("of", ""));

  return Array.from(variants).filter(v => v.length > 2);
}

// ======================
// 🔥 SCORE DE SERVIDORES
// ======================
function scoreServer(server: any) {

  const url = (server.embed || "").toLowerCase();

  let score = 0;

  if (url.includes(".m3u8")) score += 100;
  if (url.includes(".mp4")) score += 80;

  if (url.includes("streamwish")) score += 70;
  if (url.includes("filemoon")) score += 60;
  if (url.includes("streamtape")) score += 50;

  if (server.name === "jkanime") score += 90;

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

  // =====================
  // 🔥 SUB (RÁPIDO)
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
  // 🔥 LATINO (ULTRA PRO)
  // =====================
  if (lang === "latino") {

    const variants = expandTitle(title).slice(0, 10);

    for (const v of variants) {

      const results = await Promise.all([

        // 🥇 LATINO REAL
        getLatanimeServers(v, number),

        // 🥈 FUENTES
        getTioAnimeServers(v, number),
        getAnimeYTServers(v, number),
        getAnimeFenixServers(v, number),

        // 🥉 APOYO
        getAnimeIDServers(v, number)
      ]);

      const flat = results.flat().filter(Boolean);

      if (flat.length) {
        servers.push(...flat);

        // 🔥 corte temprano si hay buenos
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
