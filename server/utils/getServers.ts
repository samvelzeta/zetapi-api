import {
  getAnimeFLVServers,
  getJKAnimeServers
} from "./sources";

import { filterWorkingServers } from "./filter";

// ======================
// 🔥 UNIQUE
// ======================
function uniqueServers(list: any[]) {

  const seen = new Set();
  const result = [];

  for (const s of list) {

    if (!s?.embed) continue;

    const clean = s.embed.split("?")[0];

    if (!seen.has(clean)) {
      seen.add(clean);
      result.push(s);
    }
  }

  return result;
}

// ======================
// 🔥 SCORE
// ======================
function scoreServer(server: any) {

  const url = (server.embed || "").toLowerCase();

  if (url.includes(".m3u8")) return 1000;
  if (url.includes(".mp4")) return 900;

  if (url.includes("desu")) return 850;
  if (url.includes("magi")) return 840;

  if (url.includes("yourupload")) return 800;
  if (url.includes("ok.ru")) return 750;

  if (url.includes("filemoon")) return 700;
  if (url.includes("streamwish")) return 600;

  return 100;
}

// ======================
// 🔥 MAIN
// ======================
export async function getAllServers({ slug, number, title }: any) {

  const cleanSlug = slug.replace(/-\d+$/, "");

  let collected: any[] = [];

  // =====================
  // 🥇 JKANIME PRIMERO
  // =====================
let jk = await getJKAnimeServers(cleanSlug, number);

// 🔥 fallback con slug original
if (!jk.length && slug !== cleanSlug) {
  jk = await getJKAnimeServers(slug, number);
}

// 🔥 si aún no hay → intentar title
if (!jk.length && title) {
  jk = await getJKAnimeServers(title, number);
}

if (jk.length) {

  // 🥇 prioridad absoluta HLS
  const hls = jk.filter(s => s.embed && s.embed.includes(".m3u8"));

  if (hls.length) {
    return hls.slice(0, 5);
  }

  collected.push(...jk);
}

  // =====================
  // 🥈 ANIMEFLV
  // =====================
export async function getAnimeFLVServers(slug: string, number: number) {

  try {

    const url = `https://animeflv.net/ver/${slug}-${number}`;
    const html = await fetchHtml(url);

    if (!html) return [];

    const servers: any[] = [];

    const frames = [
      ...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)
    ];

    for (const match of frames) {

      const src = match[1];

      if (
        src.includes("facebook") ||
        src.includes("twitter") ||
        src.includes("ads")
      ) continue;

      // 🔥 NO resolver aquí
      servers.push({
        name: "flv",
        embed: src
      });
    }

    return servers;

  } catch {
    return [];
  }
}

  // =====================
  // 🔥 LIMPIEZA
  // =====================
  const filtered = await filterWorkingServers(collected);

  const unique = uniqueServers(filtered);

  // =====================
  // 🔥 ORDEN
  // =====================
  const sorted = unique.sort((a, b) => scoreServer(b) - scoreServer(a));

  return sorted.slice(0, 10);
}
