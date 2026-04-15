import {
  getJKAnimeServers,
  scrapePage
} from "./sources";

import { resolveSlugVariants } from "./slugResolver";
import { findJKAnimeSlug } from "./jkSearch";

const PROXY = "https://zetapi-api.samvelzeta.workers.dev/proxy?url=";

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

function isZilla(url: string) {
  return url.includes("zilla-networks");
}

export async function getAllServers({ slug, number, title, env }: any) {

  const variants = [
    ...resolveSlugVariants(slug),
    ...resolveSlugVariants(title || "")
  ];

  let av1: any[] = [];
  let jk: any[] = [];

  // =====================
  // 🟣 AV1
  // =====================
  for (const v of variants) {

    const url = `https://animeav1.com/media/${v}/${number}`;
    const scraped = await scrapePage(url);

    if (!scraped.length) continue;

    for (const s of scraped) {

      if (!isZilla(s.embed)) continue;

      av1.push({
        name: "Z",
        type: "embed",
        embed: s.embed
      });
    }

    if (av1.length >= 2) break;
  }

  // =====================
  // 🟢 JK NORMAL
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

      jk.push({
        name: "K",
        type: "hls",
        embed: `${PROXY}${encodeURIComponent(s.embed)}`
      });
    }

    if (jk.length >= 2) break;
  }

  // =====================
  // 🔥 RESULTADO
  // =====================
  const final = uniqueServers([
    ...av1,
    ...jk
  ]).slice(0, 6);

  // =====================
  // 🚨 SENSOR ANTI-VACÍO
  // =====================
  if (!final.length) {

    console.log("⚠️ VACÍO → FORZANDO JK");

    for (const v of variants) {

      let servers = await getJKAnimeServers(v, number);

      if (!servers.length) {
        const realSlug = await findJKAnimeSlug(v, env);
        if (realSlug) {
          servers = await getJKAnimeServers(realSlug, number);
        }
      }

      if (!servers.length) continue;

      const forced = servers.map(s => ({
        name: "K",
        type: "hls",
        embed: `${PROXY}${encodeURIComponent(s.embed)}`
      }));

      if (forced.length) {
        console.log("🔥 JK FORZADO OK");
        return forced.slice(0, 5);
      }
    }
  }

  return final;
}
