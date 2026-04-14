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
function isHLS(url: string) {
  return url.includes(".m3u8");
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
  // 🔥 AV1 SCRAPER
  // =====================
  for (const v of variants) {

    const url = `https://animeav1.com/media/${v}/${number}`;
    const scraped = await scrapePage(url);

    if (!scraped.length) continue;

    for (const s of scraped) {

      if (s.lang === "latino") {
        latino.push({
          name: "Z",
          type: "embed",
          embed: s.embed,
          lang: "latino"
        });
      }

      if (s.lang === "sub") {
        sub.push({
          name: "Z",
          type: "embed",
          embed: s.embed,
          lang: "sub"
        });
      }
    }

    if (latino.length || sub.length) break;
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

      if (!isHLS(u)) continue;

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
    ...latino, // 🥇 latino real
    ...sub,    // 🥇 japonés real
    ...jk      // 🥈 fallback
  ]).slice(0, 6);
}
