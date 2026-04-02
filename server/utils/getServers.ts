import { getServersFromAllSources } from "./sources";
import { filterWorkingServers } from "./filter";
import { expandSlugVariants } from "./slugResolver";

function scoreServer(server: any) {
  const url = (server.embed || "").toLowerCase();

  if (url.includes(".m3u8")) return 1000;
  if (url.includes(".mp4")) return 900;
  if (url.includes("filemoon")) return 800;
  if (url.includes("streamtape")) return 700;

  return 100;
}

export async function getAllServers({ slug, number, title }: any) {

  const variants = expandSlugVariants(title).slice(0, 20);

  let collected: any[] = [];

  for (const v of variants) {
    const res = await getServersFromAllSources(v, number);
    if (res.length) collected.push(...res);

    if (collected.length >= 25) break;
  }

  if (!collected.length) return [];

  const filtered = await filterWorkingServers(collected);

  // 🔥 eliminar duplicados reales
  const unique: any[] = [];
  const seen = new Set();

  for (const s of filtered) {
    const clean = s.embed.split("?")[0];
    if (!seen.has(clean)) {
      seen.add(clean);
      unique.push(s);
    }
  }

  const sorted = unique.sort((a, b) => scoreServer(b) - scoreServer(a));

  const final = sorted.slice(0, 6);

  if (final.length < 3) {
    return sorted.slice(0, 10);
  }

  return final;
}
