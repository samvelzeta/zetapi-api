import { $fetch } from "ofetch";
import {
  getAnimeFLVServers,
  getJKAnimeServers,
  getAnimeFenixServers,
  getTioAnimeServers,
  getAnimeIDServers,
  getAnimeYTServers
} from "./sources";

// =====================
const CACHE = new Map<string, { data: any[], time: number }>();
const TTL = 1000 * 60 * 5;

// =====================
function generateVariants(title: string) {
  const t = title.toLowerCase();

  return [
    t,
    t.replace(/ /g, "-"),
    t.replace(/ /g, "_"),
    t.replace(/\d+/g, ""),
    t.split(":")[0]
  ];
}

// =====================
function sortServers(servers: any[]) {
  return servers.sort((a, b) => {
    if (a.embed?.includes("jkanime")) return -1;
    if (b.embed?.includes("jkanime")) return 1;

    if (a.name === "streamwish") return -1;
    if (b.name === "streamwish") return 1;

    return 0;
  });
}

// =====================
export async function getAllServers({ slug, number, title, lang }: any) {

  const key = `${slug}-${number}-${lang}`;

  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.time < TTL) {
    return cached.data;
  }

  let servers: any[] = [];
  const variants = generateVariants(title).slice(0, 5);

  // =====================
  // 🔥 SUB
  // =====================
  if (lang === "sub") {
    const core = await Promise.all([
      getAnimeFLVServers(slug, number),
      getJKAnimeServers(slug, number)
    ]);

    servers.push(...core.flat());

    if (servers.length < 2) {
      for (const v of variants) {
        const res = await getAnimeFenixServers(v, number);
        servers.push(...res);

        if (servers.length >= 3) break;
      }
    }
  }

  // =====================
  // 🔥 LATINO
  // =====================
  if (lang === "latino") {

    for (const v of variants) {

      const res = await Promise.all([
        getAnimeYTServers(v, number), // 🥇
        getTioAnimeServers(v, number),
        getAnimeIDServers(v, number),
        getAnimeFenixServers(v, number)
      ]);

      const flat = res.flat().filter(Boolean);

      if (flat.length) {
        servers.push(...flat);
        break;
      }
    }
  }

  const unique = Array.from(
    new Map(servers.map(s => [s.embed, s])).values()
  );

  const final = sortServers(unique);

  CACHE.set(key, { data: final, time: Date.now() });

  return final;
}
