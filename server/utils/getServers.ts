import {
  getAnimeFLVServers,
  getJKAnimeServers,
  getGogoServers,
  getHiAnimeServers,
  getAnimeFenixServers,
  getAnimeLHDServers,
  getMonosChinosServers,
  getTioAnimeServers,
  getAnimeIDServers
} from "./sources";

// =====================
// 🔥 CACHE EN MEMORIA
// =====================
const CACHE = new Map<string, { data: any[], time: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutos

function getCache(key: string) {
  const entry = CACHE.get(key);
  if (!entry) return null;

  if (Date.now() - entry.time > CACHE_TTL) {
    CACHE.delete(key);
    return null;
  }

  return entry.data;
}

function setCache(key: string, data: any[]) {
  CACHE.set(key, {
    data,
    time: Date.now()
  });
}

// =====================
// 🔥 RESOLVER TITULOS (INTERNET)
// =====================
async function resolveTitles(title: string) {
  const results = new Set<string>();

  try {
    const res: any = await $fetch(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=3`
    );

    for (const anime of res.data || []) {
      if (anime.title) results.add(anime.title.toLowerCase());
      if (anime.title_english) results.add(anime.title_english.toLowerCase());
      if (anime.title_japanese) results.add(anime.title_japanese.toLowerCase());

      if (anime.title_synonyms) {
        anime.title_synonyms.forEach((t: string) =>
          results.add(t.toLowerCase())
        );
      }
    }
  } catch {}

  return Array.from(results);
}

// =====================
// 🔥 VARIANTES
// =====================
function generateVariants(title: string) {
  const base = title.toLowerCase();

  const clean = base
    .replace(/’/g, "")
    .replace(/'/g, "")
    .replace(/:/g, "")
    .replace(/  +/g, " ")
    .trim();

  return [
    clean,
    clean.replace(/ /g, "-"),
    clean.replace(/ /g, "_"),
    clean.replace(/season \d+/g, ""),
    clean.replace(/temporada \d+/g, ""),
    clean.replace(/segunda temporada/g, ""),
    clean.replace(/2nd season/g, ""),
    clean.replace(/\d+/g, ""),
    clean.split(":")[0],
    clean.split("-")[0],
    clean.replace("season", ""),
    clean.replace("part", "")
  ];
}

// =====================
// 🔥 PRIORIDAD
// =====================
function sortServers(servers: any[]) {
  return servers.sort((a, b) => {

    // 🥇 JKANIME
    if (a.embed?.includes("jkanime")) return -1;
    if (b.embed?.includes("jkanime")) return 1;

    // 🥈 STREAMWISH
    if (a.name === "streamwish") return -1;
    if (b.name === "streamwish") return 1;

    // 🥉 OTROS
    const priority = ["filemoon", "streamtape"];

    return priority.indexOf(a.name) - priority.indexOf(b.name);
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

  const cacheKey = `${title}-${number}-${lang}`;

  // 🔥 CACHE
  const cached = getCache(cacheKey);
  if (cached) return cached;

  let servers: any[] = [];

  // 🔥 variantes base
  const baseVariants = generateVariants(title);

  // 🔥 nombres reales desde internet
  const resolved = await resolveTitles(title);

  // 🔥 unir y limitar
  const variants = Array.from(new Set([
    ...baseVariants,
    ...resolved
  ])).slice(0, 15);

  // =====================
  // 🔥 JAPONES
  // =====================
  if (lang === "sub") {
    const core = await Promise.all([
      getAnimeFLVServers(slug, number),
      getJKAnimeServers(slug, number)
    ]);

    servers.push(...core.flat());

    if (servers.length < 3) {
      for (const v of variants) {
        const fallback = await Promise.all([
          getGogoServers(v),
          getHiAnimeServers(v),
          getAnimeFenixServers(v, number)
        ]);

        servers.push(...fallback.flat());

        if (servers.length > 6) break;
      }
    }
  }

  // =====================
  // 🔥 LATINO (INTELIGENTE)
  // =====================
  if (lang === "latino") {

    for (const v of variants) {

      const results = await Promise.all([
        getTioAnimeServers(v, number),
        getAnimeIDServers(v, number),
        getAnimeFenixServers(v, number),
        getMonosChinosServers(v, number),
        getAnimeLHDServers(v, number)
      ]);

      const flat = results.flat().filter(Boolean);

      if (flat.length) {
        servers.push(...flat);

        // 🔥 parar si ya hay suficientes
        if (servers.length >= 4) break;
      }
    }
  }

  // =====================
  // 🔥 LIMPIAR DUPLICADOS
  // =====================
  const unique = Array.from(
    new Map(
      servers
        .filter(s => s?.embed)
        .map(s => [s.embed, s])
    ).values()
  );

  const final = sortServers(unique);

  // 🔥 guardar cache
  setCache(cacheKey, final);

  return final;
}
