import {
  getAnimeFLVServers,
  getJKAnimeServers
} from "./sources";

import { filterWorkingServers } from "./filter";
import { resolveSlugVariants } from "./slugResolver";

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
function scoreServer(server: any) {

  const url = (server.embed || "").toLowerCase();

  if (url.includes(".m3u8")) return 1000;

  if (url.includes("yourupload")) return 900;
  if (url.includes("ok.ru")) return 850;
  if (url.includes("maru")) return 800;

  if (url.includes("filemoon")) return 700;
  if (url.includes("streamwish")) return 600;

  return 100;
}

// ======================
export async function getAllServers({ slug, number, title }: any) {

  const cleanSlug = slug.replace(/-\d+$/, "");

  const variants = [
    ...(await resolveSlugVariants(cleanSlug)),
    ...(await resolveSlugVariants(title))
  ];

  let collected: any[] = [];

  for (const v of variants) {

    // 🥇 JKANIME
    const jk = await getJKAnimeServers(v, number);

    if (jk.length) {

      const hls = jk.filter(s => s.embed.includes(".m3u8"));

      if (hls.length) {
        return uniqueServers(hls).slice(0, 3);
      }

      collected.push(...jk);
    }

    // 🥈 FLV
    const flv = await getAnimeFLVServers(v, number);

    if (flv.length) {
      collected.push(...flv);
    }

    if (collected.length >= 6) break;
  }

  if (!collected.length) return [];

  const filtered = await filterWorkingServers(collected);
  const unique = uniqueServers(filtered);
  const sorted = unique.sort((a, b) => scoreServer(b) - scoreServer(a));

  return sorted.slice(0, 6);
}
