import {
  getAnimeFLVServers,
  getJKAnimeServers,
  getTioAnimeServers
} from "./sources";

import { filterWorkingServers } from "./filter";
import { expandSlugVariants, smartTrimSlug } from "./slugResolver";

// ======================
function uniqueServers(list: any[]) {

  const seen = new Set();
  const result = [];

  for (const s of list) {

    const clean = s.embed.split("?")[0];

    if (!seen.has(clean)) {
      seen.add(clean);
      result.push(s);
    }
  }

  return result;
}

// ======================
function scoreServer(server: any) {

  const url = (server.embed || "").toLowerCase();

  // 🥇 HLS primero SIEMPRE
  if (url.includes(".m3u8")) return 1000;

  // 🥈 prioridad real que pediste
  if (url.includes("yourupload")) return 900;
  if (url.includes("maru")) return 850;
  if (url.includes("ok.ru")) return 800;

  if (url.includes("filemoon")) return 700;
  if (url.includes("streamwish")) return 600;

  return 100;
}

// ======================
export async function getAllServers({ slug, number, title, lang }: any) {

  const trimmed = smartTrimSlug(slug);
  const variants = expandSlugVariants(trimmed);

  let collected: any[] = [];

  for (const v of variants) {

    // 🔥 1. JKANIME
    const jk = await getJKAnimeServers(v, number);

    if (jk.length) {
      collected.push(...jk);

      // si hay HLS → prioridad máxima
      if (jk.some(s => s.embed.includes(".m3u8"))) break;
    }

    // 🔥 2. ANIMEFLV
    const flv = await getAnimeFLVServers(v, number);

    if (flv.length) {
      collected.push(...flv);
    }

    if (collected.length >= 5) break;
  }

  // 🔥 LATINO
  if (lang === "latino") {
    const tio = await getTioAnimeServers(title, number);
    collected.push(...tio);
  }

  if (!collected.length) return [];

  const filtered = await filterWorkingServers(collected);
  const unique = uniqueServers(filtered);

  const sorted = unique.sort((a, b) => scoreServer(b) - scoreServer(a));

  return sorted.slice(0, 6);
}
