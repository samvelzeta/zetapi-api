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

// ======================w
// 🧠 NORMALIZADOR
// ======================
function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[:\-]/g, " ")
    .replace(/\b(season|temporada|part|parte|capitulo|episode)\b/g, "")
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ======================
// 🧠 EXPANSIÓN AVANZADA
// ======================
function expandTitle(title: string) {
  const base = normalizeTitle(title);
  const variants = new Set<string>();

  variants.add(base);
  variants.add(base.replace(/ /g, "-"));
  variants.add(base.replace(/ /g, ""));
  variants.add(base.replace(/ /g, "_"));

  // 🔥 multi idioma básico
  variants.add(base.replace("shingeki no kyojin", "attack on titan"));
  variants.add(base.replace("attack on titan", "shingeki no kyojin"));

  variants.add(base + " anime");
  variants.add(base + " online");
  variants.add(base + " latino");
  variants.add(base + " sub");

  return Array.from(variants).filter(v => v.length > 2);
}

// ======================
// 🔥 SCORE
// ======================
function scoreServer(server: any) {
  const url = (server.embed || "").toLowerCase();
  let score = 0;

  if (url.includes(".m3u8")) score += 100;
  if (url.includes(".mp4")) score += 90;

  if (url.includes("filemoon")) score += 80;
  if (url.includes("streamtape")) score += 75;
  if (url.includes("ok.ru")) score += 70;

  if (server.name === "jkanime") score += 85;

  if (url.includes("streamwish")) score -= 50;

  return score;
}

// ======================
// 🔥 SORT
// ======================
function sortServers(servers: any[]) {
  return servers.sort((a, b) => scoreServer(b) - scoreServer(a));
}

// ======================
// 🔥 PIPELINE
// ======================
async function processServers(raw: any[]) {
  if (!raw?.length) return [];

  const unique = Array.from(
    new Map(raw.map(s => [s.embed, s])).values()
  );

  const filtered = await filterWorkingServers(unique);
  const sorted = sortServers(filtered);

  return sorted.slice(0, 5);
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
  // 🔹 SUB (más robusto)
  // =====================
  if (lang === "sub") {

    const variants = expandTitle(title).slice(0, 6);

    for (const v of variants) {
      const [jk, flv] = await Promise.all([
        getJKAnimeServers(v, number),
        getAnimeFLVServers(v, number)
      ]);

      const found = [...jk, ...flv];

      if (found.length) {
        servers.push(...found);
        if (servers.length >= 4) break;
      }
    }

    return await processServers(servers);
  }

  // =====================
  // 🔹 LATINO (ULTRA)
  // =====================
  if (lang === "latino") {

    const variants = expandTitle(title).slice(0, 12);

    for (const v of variants) {

      const results = await Promise.all([
        getLatanimeServers(v, number),
        getTioAnimeServers(v, number),
        getAnimeYTServers(v, number),
        getAnimeFenixServers(v, number),
        getAnimeIDServers(v, number)
      ]);

      const flat = results.flat().filter(Boolean);

      if (flat.length) {
        servers.push(...flat);

        if (servers.length >= 5) break;
      }
    }

    // 🔥 fallback
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
