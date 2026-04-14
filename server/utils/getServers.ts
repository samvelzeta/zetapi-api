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

  return list.filter(s => {
    if (!s?.embed) return false;

    const clean = s.embed.split("?")[0];

    if (seen.has(clean)) return false;

    seen.add(clean);
    return true;
  });
}

// ======================
function isHLS(url: string) {
  return url.includes(".m3u8");
}

// ======================
// 🔥 AV1
// ======================
async function tryAV1(variants: string[], number: number, requestedLang: string) {

  for (const v of variants) {

    const url = `https://animeav1.com/media/${v}/${number}`;
    const scraped = await scrapePage(url);

    if (!scraped.length) continue;

    const filtered = scraped.filter(s => s.lang === requestedLang);

    if (filtered.length) return filtered;
  }

  return [];
}

// ======================
// 🔥 JK
// ======================
async function tryJK(variants: string[], number: number, env: any) {

  for (const v of variants) {

    let jk = await getJKAnimeServers(v, number);

    if (!jk.length) {
      const realSlug = await findJKAnimeSlug(v, env);
      if (realSlug) {
        jk = await getJKAnimeServers(realSlug, number);
      }
    }

    if (!jk.length) continue;

    return jk.map(s => ({
      name: "K",
      type: "hls",
      embed: `${PROXY}${encodeURIComponent(s.embed)}`,
      lang: "sub"
    }));
  }

  return [];
}

// ======================
// 🔥 MAIN FINAL
// ======================
export async function getAllServers({ slug, number, title, env, lang }: any) {

  const requestedLang = lang === "latino" ? "latino" : "sub";

  const variants = [
    ...resolveSlugVariants(slug),
    ...resolveSlugVariants(title || "")
  ];

  // 🥇 AV1
  let av1 = await tryAV1(variants, number, requestedLang);

  // 🔁 retry AV1
  if (!av1.length) {
    const retry = [
      ...variants,
      slug.replace(/-/g, ""),
      slug.split("-").slice(0, 2).join("-")
    ];

    av1 = await tryAV1(retry, number, requestedLang);
  }

  // 🥈 JK
  const jk = await tryJK(variants, number, env);

  // 🔥 RESULT
  if (av1.length) {
    return uniqueServers([...av1, ...jk]).slice(0, 5);
  }

  if (jk.length) {
    return uniqueServers(jk).slice(0, 5);
  }

  return [];
}
