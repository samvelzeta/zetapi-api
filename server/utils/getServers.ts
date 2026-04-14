import {
  getJKAnimeServers
} from "./sources";

import { fetchHtml } from "./fetcher";
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
// 🔥 EXTRAER ZILLA DIRECTO (SIN SCRAPER)
// ======================
function extractZilla(html: string) {

  const results: string[] = [];

  const matches = html.match(/https?:\/\/[^"' ]*zilla-networks[^"' ]*/g) || [];

  for (const m of matches) {
    results.push(m);
  }

  return results;
}

// ======================
// 🔥 SENSOR AV1 REAL
// ======================
async function tryAV1(variants: string[], number: number, requestedLang: string) {

  let results: any[] = [];

  for (const v of variants) {

    try {

      const url = `https://animeav1.com/media/${v}/${number}`;
      const html = await fetchHtml(url);

      if (!html) continue;

      const zillaLinks = extractZilla(html);

      if (!zillaLinks.length) continue;

      for (const link of zillaLinks) {

        results.push({
          name: "Z",
          type: "embed",
          embed: link,
          lang: requestedLang
        });
      }

      // 🔥 cortar cuando encuentra algo
      if (results.length) break;

    } catch {}
  }

  return results;
}

// ======================
// 🔥 SENSOR JK
// ======================
async function tryJK(variants: string[], number: number, env: any) {

  let jkServers: any[] = [];

  for (const v of variants) {

    let jk = await getJKAnimeServers(v, number);

    if (!jk.length) {
      const realSlug = await findJKAnimeSlug(v, env);
      if (realSlug) {
        jk = await getJKAnimeServers(realSlug, number);
      }
    }

    if (!jk.length) continue;

    for (const s of jk) {

      const u = s.embed || "";

      if (!isHLS(u)) continue;

      jkServers.push({
        name: "K",
        type: "hls",
        embed: `${PROXY}${encodeURIComponent(u)}`,
        lang: "sub"
      });
    }

    if (jkServers.length) break;
  }

  return jkServers;
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

  // =====================
  // 🥇 AV1
  // =====================
  let av1 = await tryAV1(variants, number, requestedLang);

  // =====================
  // 🔁 SENSOR REINTENTO AV1
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
  // 🥈 JK BACKUP
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
