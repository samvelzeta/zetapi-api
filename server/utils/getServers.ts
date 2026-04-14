import {
  getJKAnimeServers,
  scrapePage
} from "./sources";

import { resolveSlugVariants } from "./slugResolver";
import { findJKAnimeSlug } from "./jkSearch";

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
// 🔥 AV1 INTENTO
// ======================
async function tryAV1(variants: string[], number: number) {

  let latino: any[] = [];
  let sub: any[] = [];

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

  return { latino, sub };
}

// ======================
// 🔥 JK BACKUP
// ======================
async function tryJK(variants: string[], number: number, env: any) {

  let results: any[] = [];

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

      results.push({
        name: "K",
        type: "hls",
        embed: `${PROXY}${encodeURIComponent(s.embed)}`,
        lang: "sub"
      });
    }

    if (results.length) break;
  }

  return results;
}

// ======================
// 🔥 MAIN FINAL
// ======================
export async function getAllServers({ slug, number, title, env }: any) {

  const variants = [
    ...resolveSlugVariants(slug),
    ...resolveSlugVariants(title || "")
  ];

  // 🥇 AV1
  let { latino, sub } = await tryAV1(variants, number);

  // 🔁 SENSOR REINTENTO
  if (!latino.length && !sub.length) {

    const retryVariants = [
      ...variants,
      slug.replace(/-/g, ""),
      slug.split("-").slice(0, 2).join("-"),
      slug.split("-").slice(0, 3).join("-")
    ];

    const retry = await tryAV1(retryVariants, number);

    latino = retry.latino;
    sub = retry.sub;
  }

  // 🥈 JK
  const jk = await tryJK(variants, number, env);

  // 🔥 FINAL
  const final = uniqueServers([
    ...latino,
    ...sub,
    ...jk
  ]).slice(0, 6);

  return final;
}
