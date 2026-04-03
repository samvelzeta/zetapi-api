import {
  getAnimeFLVServers,
  getJKAnimeServers,
  getTioAnimeServers
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
export async function getAllServers({ slug, number, title, lang }: any) {

  let servers: any[] = [];

  // =====================
  // 🔥 SUB
  // =====================
  const [flv, jk] = await Promise.all([
    getAnimeFLVServers(slug, number),
    getJKAnimeServers(slug, number)
  ]);

  // 🔥 prioridad real
  if (jk.some(s => s.embed.includes(".m3u8"))) {
    servers = jk;
  } else {
    servers = [...jk, ...flv];
  }

  // =====================
  // 🔥 LATINO EXTRA
  // =====================
  if (lang === "latino") {
    const tio = await getTioAnimeServers(title, number);
    servers.push(...tio);
  }

  if (!servers.length) return [];

  // 🔥 FILTRO
  const filtered = await filterWorkingServers(servers);

  // 🔥 UNICOS
  const unique = uniqueServers(filtered);

  // 🔥 ORDEN
  const sorted = unique.sort((a, b) => scoreServer(b) - scoreServer(a));

  return sorted;
}
