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
// 🔥 SENSOR CORE
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

    // 🔥 si ya encontró algo → cortar
    if (latino.length || sub.length) break;
  }

  return { latino, sub };
}

// ======================
async function tryJK(variants: string[], number: number, env: any) {

  let jk: any[] = [];

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

    if (jk.length) break;
  }

  return jk;
}

// ======================
// 🔥 MAIN CON SENSOR
// ======================
export async function getAllServers({ slug, number, title, env }: any) {

  const baseVariants = [
    ...resolveSlugVariants(slug),
    ...resolveSlugVariants(title || "")
  ];

  // =====================
  // 🥇 PRIMER INTENTO AV1
  // =====================
  let { latino, sub } = await tryAV1(baseVariants, number);

  // =====================
  // 🔁 SENSOR: REINTENTO AV1
  // =====================
  if (!latino.length && !sub.length) {

    const extended = [
      ...baseVariants,
      slug.replace(/-/g, ""),
      slug.split("-").slice(0, 2).join("-"),
      slug.split("-").slice(0, 3).join("-")
    ];

    const retry = await tryAV1(extended, number);

    latino = retry.latino;
    sub = retry.sub;
  }

  // =====================
  // 🥈 JK SIEMPRE COMO BACKUP
  // =====================
  const jk = await tryJK(baseVariants, number, env);

  // =====================
  // 🚨 SENSOR FINAL
  // =====================
  if (!latino.length && !sub.length && !jk.length) {

    // 🔥 último intento global
    const lastTry = await tryAV1(baseVariants.reverse(), number);

    latino = lastTry.latino;
    sub = lastTry.sub;
  }

  // =====================
  // 🔥 NUNCA VACÍO
  // =====================
  const final = uniqueServers([
    ...latino,
    ...sub,
    ...jk
  ]).slice(0, 6);

  // 🔥 fallback absoluto
  if (!final.length) {
    return jk.length ? jk : [];
  }

  return final;
}
