import { getServersFromAllSources } from "./sources";
import { filterWorkingServers } from "./filter";

import { getJKAnimeServers } from "./scrapers/jkanime";
import { getAnimeFLVServers } from "./scrapers/animeflv";

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

  return 100;
}

// ======================
export async function getAllServers({ slug, number, title }: any) {

  let collected: any[] = [];

  // 🔥 1. JKANIME (PRIORIDAD)
  const jk = await getJKAnimeServers(slug, number);
  collected.push(...jk);

  // 🔥 2. ANIMEFLV SI NO HAY HLS
  if (!collected.some(s => s.embed.includes(".m3u8"))) {
    const flv = await getAnimeFLVServers(slug, number);
    collected.push(...flv);
  }

  // 🔥 3. FALLBACK GENERAL
  if (!collected.length) {
    const fallback = await getServersFromAllSources(slug, number);
    collected.push(...fallback);
  }

  if (!collected.length) return [];

  // 🔥 FILTRAR
  const filtered = await filterWorkingServers(collected);

  // 🔥 UNICOS
  const unique = uniqueServers(filtered);

  // 🔥 ORDEN
  const sorted = unique.sort((a, b) => scoreServer(b) - scoreServer(a));

  // 🔥 GARANTIZAR MÍNIMO 3
  if (sorted.length >= 3) return sorted.slice(0, 6);

  return unique.slice(0, 5);
}
