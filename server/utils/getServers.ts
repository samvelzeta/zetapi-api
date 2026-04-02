import { getServersFromAllSources } from "./sources";
import { filterWorkingServers } from "./filter";
import { expandSlugVariants } from "./slugResolver";

// ======================
// 🔥 SCORE
// ======================
function scoreServer(server: any) {
  const url = (server.embed || "").toLowerCase();

  let score = 0;

  if (url.includes(".m3u8")) score += 1000;
  else if (url.includes(".mp4")) score += 900;

  else if (url.includes("filemoon")) score += 800;
  else if (url.includes("streamtape")) score += 700;

  else score += 100;

  return score;
}

// ======================
// 🔥 MAIN
// ======================
export async function getAllServers({
  slug,
  number,
  title,
  lang
}: any) {

  const variants = expandSlugVariants(title).slice(0, 25);

  let collected: any[] = [];

  for (const v of variants) {

    const servers = await getServersFromAllSources(v, number);

    if (servers.length) {
      collected.push(...servers);
    }

    if (collected.length >= 30) break;
  }

  if (!collected.length) return [];

  const filtered = await filterWorkingServers(collected);

  const unique = Array.from(
    new Map(filtered.map(s => [s.embed, s])).values()
  );

  const sorted = unique.sort((a, b) => scoreServer(b) - scoreServer(a));

  return sorted.slice(0, 6);
}
