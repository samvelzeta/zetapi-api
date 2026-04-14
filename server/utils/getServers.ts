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
// 🔥 SENSOR AV1 (REAL)
// ======================
async function tryAV1(variants: string[], number: number, lang: string) {

  for (const v of variants) {

    try {

      const url = `https://animeav1.com/media/${v}/${number}`;
      const scraped = await scrapePage(url);

      if (!scraped.length) continue;

      const filtered = scraped.filter(s => s.lang === lang);

      if (filtered.length) {
        return filtered.map(s => ({
          name: "Z",
          type: "embed",
          embed: s.embed,
          lang
        }));
      }

    } catch {}
  }

  return [];
}

// ======================
// 🔥 SENSOR JK
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

    const filtered = jk.filter(s => isHLS(s.embed));

    if (filtered.length) {
      return filtered.map(s => ({
        name: "K",
        type: "hls",
        embed: `${PROXY}${encodeURIComponent(s.embed)}`,
        lang: "sub"
      }));
    }
  }

  return [];
}

// ======================
// 🔥 MAIN
// ======================
export async function getAllServers({ slug, number, title, env, lang }: any) {

  const requestedLang = lang === "latino" ? "latino" : "sub";

  const variants = [
    ...resolveSlugVariants(slug),
    ...resolveSlugVariants(title || "")
  ];

  // =====================
  // 🥇 AV1
  // =====================
  let av1 = await tryAV1(variants, number, requestedLang);

  // =====================
  // 🔁 SENSOR RETRY (SLUG FALLBACK)
  // =====================
  if (!av1.length) {

    const retryVariants = [
      ...variants,
      slug.replace(/-/g, ""),
      slug.split("-").slice(0, 2).join("-"),
      slug.split("-").slice(0, 3).join("-")
    ];

    av1 = await tryAV1(retryVariants, number, requestedLang);
  }

  // =====================
  // 🥈 JK SIEMPRE BACKUP
  // =====================
  const jk = await tryJK(variants, number, env);

  // =====================
  // 🔥 PRIORIDAD FINAL
  // =====================
  if (av1.length) {
    return uniqueServers([
      ...av1,
      ...jk
    ]).slice(0, 5);
  }

  if (jk.length) {
    return uniqueServers(jk).slice(0, 5);
  }

  return [];
}
