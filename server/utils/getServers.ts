import { getServersFromAllSources } from "./sources";
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
export async function getAllServers({ slug, number, title }: any) {

  const collected = await getServersFromAllSources(slug, number);

  if (!collected.length) return [];

  const filtered = await filterWorkingServers(collected);
  const unique = uniqueServers(filtered);

  const sorted = unique.sort((a, b) => scoreServer(b) - scoreServer(a));

  // 🔥 GARANTIZAR MÍNIMO 3
  if (sorted.length >= 3) return sorted.slice(0, 6);

  // 🔥 fallback (NO dejar vacío)
  return unique.slice(0, 5);
}
