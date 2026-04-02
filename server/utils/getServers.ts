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
export async function getAllServers({
  slug,
  number,
  title,
  lang
}: any) {

  let collected: any[] = [];

  // 🔥 SUB
  const subSources = await Promise.all([
    getJKAnimeServers(slug, number),
    getAnimeFLVServers(slug, number)
  ]);

  collected.push(...subSources.flat());

  // 🔥 LATINO
  const latSources = await Promise.all([
    getLatanimeServers(title, number),
    getTioAnimeServers(title, number),
    getAnimeYTServers(title, number),
    getAnimeFenixServers(title, number),
    getAnimeIDServers(title, number)
  ]);

  collected.push(...latSources.flat());

  if (!collected.length) return [];

  // 🔥 FILTRAR
  const filtered = await filterWorkingServers(collected);

  // 🔥 UNICOS
  const unique = uniqueServers(filtered);

  // 🔥 ORDEN
  const sorted = unique.sort((a, b) => scoreServer(b) - scoreServer(a));

  // 🔥 GARANTIZAR MINIMO 3
  if (sorted.length < 3) return sorted;

  return sorted.slice(0, 6);
}
