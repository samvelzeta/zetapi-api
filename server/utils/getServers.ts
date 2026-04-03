import {
  getAnimeFLVServers,
  getJKAnimeServers,
  getTioAnimeServers
} from "./sources";

import { filterWorkingServers } from "./filter";
import { expandSlugVariants } from "./slugResolver";

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

  if (url.includes(".m3u8")) return 1000;
  if (url.includes(".mp4")) return 900;
  if (url.includes("filemoon")) return 800;
  if (url.includes("streamtape")) return 700;
  if (url.includes("streamwish")) return 600;

  return 100;
}

// ======================
export async function getAllServers({ slug, number, title, lang }: any) {

  const variants = expandSlugVariants(slug).slice(0, 8);

  let collected: any[] = [];

  // =====================
  // 🔥 BUSQUEDA INTELIGENTE
  // =====================
  for (const v of variants) {

    // 🔥 1. JKANIME PRIMERO
    const jk = await getJKAnimeServers(v, number);

    if (jk.length) {
      collected.push(...jk);

      // 🔥 si ya hay HLS → parar
      if (jk.some(s => s.embed.includes(".m3u8"))) break;
    }

    // 🔥 2. ANIMEFLV
    const flv = await getAnimeFLVServers(v, number);
    if (flv.length) {
      collected.push(...flv);
    }

    // 🔥 si ya tenemos suficiente → parar
    if (collected.length >= 3) break;
  }

  // =====================
  // 🔥 LATINO EXTRA
  // =====================
  if (lang === "latino") {
    const tio = await getTioAnimeServers(title, number);
    collected.push(...tio);
  }

  if (!collected.length) return [];

  // 🔥 FILTRAR
  const filtered = await filterWorkingServers(collected);

  // 🔥 UNICOS
  const unique = uniqueServers(filtered);

  // 🔥 ORDEN
  const sorted = unique.sort((a, b) => scoreServer(b) - scoreServer(a));

  return sorted.slice(0, 6);
}
