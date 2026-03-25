import {
  getAnimeFLVServers,
  getJKAnimeServers,
  getTioAnimeServers,
  getAnimeIDServers,
  getAnimeYTServers,
  getAnimeFenixServers
} from "./sources";
 import { filterWorkingServers } from "./filter";

// =====================
// 🔥 VARIANTES
// =====================
function expandTitle(title: string) {
  const t = title.toLowerCase();

  return [
    t,
    t.replace(/ /g, "-"),
    t.replace(/ /g, ""),
    t.replace(/\d+/g, ""),
    t.split(":")[0],
    t.replace("season", ""),
    t.replace("segunda temporada", "")
  ];
}

// =====================
// 🔥 PRIORIDAD
// =====================
function sortServers(servers: any[]) {
  return servers.sort((a, b) => {

    // 🥇 STREAMWISH
    if (a.name === "streamwish") return -1;
    if (b.name === "streamwish") return 1;

    // 🥈 JKANIME
    if (a.embed?.includes("jkanime")) return -1;
    if (b.embed?.includes("jkanime")) return 1;

    return 0;
  });
}

// =====================
// 🔥 MAIN
// =====================
export async function getAllServers({ slug, number, title, lang }) {

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
  // 🔥 LATINO (OPTIMIZADO)
  // =====================
  if (lang === "latino") {

    const variants = expandTitle(title).slice(0, 5);

    for (const v of variants) {

      const results = await Promise.all([
        getTioAnimeServers(v, number),
        getAnimeIDServers(v, number),
        getAnimeYTServers(v, number),
        getAnimeFenixServers(v, number)
      ]);

      const flat = results.flat().filter(Boolean);

      if (flat.length) {
        servers.push(...flat);
        break; // 🔥 CORTE TEMPRANO
      }
    }
  }


const unique = Array.from(
  new Map(servers.map(s => [s.embed, s])).values()
);

const filtered = await filterWorkingServers(unique);

return sortServers(filtered);
