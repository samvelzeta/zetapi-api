import {
  getJKAnimeServers,
  scrapePage
} from "./sources";

import { resolveSlugVariants } from "./slugResolver";
import { findJKAnimeSlug } from "./jkSearch";

// ======================
const PROXY = "https://zetapi-api.samvelzeta.workers.dev/proxy?url=";

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
function isGoodHLS(url: string) {
  return (
    url.includes(".m3u8") &&
    !url.includes("mp4upload") &&
    !url.includes("mega") &&
    !url.includes("1fichier")
  );
}

// ======================
function isZilla(url: string) {
  return url.includes("zilla-networks");
}

// ======================
export async function getAllServers({ slug, number, title, env }: any) {

  const variants = [
    ...resolveSlugVariants(slug),
    ...resolveSlugVariants(title || "")
  ];

  let latino: any[] = [];
  let sub: any[] = [];
  let jk: any[] = [];

  // =====================
  // 🔥 SCRAPER AV1
  // =====================
  for (const v of variants) {

    const url = `https://animeav1.com/media/${v}/${number}`;
    const scraped = await scrapePage(url);

    if (!scraped.length) continue;

    for (const s of scraped) {

      const u = s.embed || "";

      // 🟣 SOLO ZILLA
      if (!isZilla(u)) continue;

      // 🔥 DUPLICAR LIMPIO (NO HAY OTRA FORMA)
      latino.push({
        name: "Z",
        type: "embed",
        embed: u,
        lang: "latino"
      });

      sub.push({
        name: "Z",
        type: "embed",
        embed: u,
        lang: "sub"
      });
    }

    if (latino.length >= 2) break;
  }

  // =====================
  // 🔥 JKANIME (SIEMPRE)
  // =====================
  for (const v of variants) {

    let servers = await getJKAnimeServers(v, number);

    if (!servers.length) {
      const realSlug = await findJKAnimeSlug(v, env);
      if (realSlug) {
        servers = await getJKAnimeServers(realSlug, number);
      }
    }

    if (!servers.length) continue;

    for (const s of servers) {

      const u = s.embed || "";

      if (!isGoodHLS(u)) continue;

      jk.push({
        name: "K",
        type: "hls",
        embed: `${PROXY}${encodeURIComponent(u)}`,
        lang: "sub"
      });
    }

    if (jk.length >= 2) break;
  }

  // =====================
  // 🔥 RESULTADO FINAL
  // =====================

  return uniqueServers([
    ...latino, // 🥇 ZILLA
    ...sub,    // 🥇 ZILLA
    ...jk      // 🥈 JK HLS
  ]).slice(0, 6);
}
