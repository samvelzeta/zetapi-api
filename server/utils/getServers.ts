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
// 🧠 SUPER NORMALIZADOR
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
// 🧠 EXPANSIÓN MASIVA
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

  // 🔥 variantes inteligentes
  variants.add(base + " castellano");
  variants.add(base + " hd");
  variants.add(base + " capitulo");

  // quitar palabras comunes
  variants.add(base.replace("the", ""));
  variants.add(base.replace("no", ""));
  variants.add(base.replace("of", ""));

  return Array.from(variants).filter(v => v.length > 2);
}

// =====================
// 🔥 PRIORIDAD
// =====================
function sortServers(servers: any[]) {
  return servers.sort((a, b) => {

    const A = (a.embed || "").toLowerCase();
    const B = (b.embed || "").toLowerCase();

    // 🥇 m3u8
    if (A.includes(".m3u8")) return -1;
    if (B.includes(".m3u8")) return 1;

    // 🥈 streamwish / directo
    if (A.includes("streamwish")) return -1;
    if (B.includes("streamwish")) return 1;

    // 🥉 mp4
    if (A.includes(".mp4")) return -1;
    if (B.includes(".mp4")) return 1;

    // 🧠 JKAnime arriba (pero no primero si hay m3u8)
    if (a.name === "jkanime") return -1;
    if (b.name === "jkanime") return 1;

    return 0;
  });
}

// =====================
// 🔥 MAIN
// =====================
export async function getAllServers({
  slug,
  number,
  title,
  lang
}: any) {

  let servers: any[] = [];

  // =====================
  // 🔥 SUB (ULTRA RÁPIDO)
  // =====================
  if (lang === "sub") {

    const [flv, jk] = await Promise.all([
      getAnimeFLVServers(slug, number),
      getJKAnimeServers(slug, number)
    ]);

    // 🔥 prioridad JKAnime primero
    servers = [...jk, ...flv];

    const unique = Array.from(
      new Map(servers.map(s => [s.embed, s])).values()
    );

    const filtered = await filterWorkingServers(unique);

    return sortServers(filtered);
  }

  // =====================
  // 🔥 LATINO (ULTRA PRO)
  // =====================
  if (lang === "latino") {

    const variants = expandTitle(title).slice(0, 12);

    for (const v of variants) {

      const results = await Promise.all([

        // 🥇 PRIORIDAD ABSOLUTA
        getLatanimeServers(v, number),

        // 🥈 CORE
        getTioAnimeServers(v, number),
        getAnimeYTServers(v, number),
        getAnimeFenixServers(v, number),

        // 🥉 APOYO
        getAnimeIDServers(v, number)
      ]);

      const flat = results.flat().filter(Boolean);

      if (flat.length) {
        servers.push(...flat);

        // 🔥 si ya hay suficientes buenos, parar
        if (flat.length >= 3) break;
      }
    }

    // 🔥 fallback: usar SUB si latino falla
    if (!servers.length) {
      const [flv, jk] = await Promise.all([
        getAnimeFLVServers(slug, number),
        getJKAnimeServers(slug, number)
      ]);

      servers = [...jk, ...flv];
    }
  }

  // =====================
  // 🔥 LIMPIEZA FINAL
  // =====================
  const unique = Array.from(
    new Map(servers.map(s => [s.embed, s])).values()
  );

  const filtered = await filterWorkingServers(unique);

  return sortServers(filtered);
}
