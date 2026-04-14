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

  let zilla: any[] = [];
  let hls: any[] = [];

  // =====================
  // 🟣 ZILLA (AV1)
  // =====================
  for (const v of variants) {

    const url = `https://animeav1.com/media/${v}/${number}`;
    const scraped = await scrapePage(url);

    for (const s of scraped) {

      const u = s.embed || "";

      if (u.includes("zilla-networks")) {
        zilla.push({
          name: "Z",
          type: "embed",
          embed: u
        });
      }
    }

    if (zilla.length) break;
  }

  // =====================
  // 🟢 JKANIME HLS
  // =====================
  for (const v of variants) {

    let jk = await getJKAnimeServers(v, number);

    if (!jk.length) {
      const realSlug = await findJKAnimeSlug(v, env);
      if (realSlug) {
        jk = await getJKAnimeServers(realSlug, number);
      }
    }

    for (const s of jk) {

      const u = s.embed || "";

      if (isHLS(u)) {
        hls.push({
          name: "K",
          type: "hls",
          embed: `${PROXY}${encodeURIComponent(u)}`
        });
      }
    }

    if (hls.length) break;
  }

  // =====================
  // 🔥 RESULTADO FINAL LIMPIO
  // =====================
  return uniqueServers([
    ...zilla,
    ...hls
  ]).slice(0, 5);
}
