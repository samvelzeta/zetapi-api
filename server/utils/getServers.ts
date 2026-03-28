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

    // 🥇 m3u8 primero
    if (a.embed?.includes(".m3u8")) return -1;
    if (b.embed?.includes(".m3u8")) return 1;

    // 🥈 streamwish
    if (a.name === "streamwish") return -1;
    if (b.name === "streamwish") return 1;

    // 🥉 mp4
    if (a.embed?.includes(".mp4")) return -1;
    if (b.embed?.includes(".mp4")) return 1;

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
  // 🔥 SUB (RÁPIDO)
  // =====================
  if (lang === "sub") {

    const [flv, jk] = await Promise.all([
      getAnimeFLVServers(slug, number),
      getJKAnimeServers(slug, number)
    ]);

    servers = [...flv, ...jk];

    return sortServers(
      Array.from(new Map(servers.map(s => [s.embed, s])).values())
    );
  }

  // =====================
  // 🔥 LATINO (ULTRA)
  // =====================
  if (lang === "latino") {

    const variants = expandTitle(title).slice(0, 10);

    for (const v of variants) {

      const results = await Promise.all([

        // 🥇 PRIORIDAD
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
        break; // 🔥 CORTE TEMPRANO
      }
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
