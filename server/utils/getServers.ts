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
  // 🔥 BUSQUEDA PARALELA REAL
  // =====================
  await Promise.all(

    variants.map(async (v) => {

      // =====================
      // 🟣 AV1
      // =====================
      try {

        const url = `https://animeav1.com/media/${v}/${number}`;
        const scraped = await scrapePage(url);

        if (!scraped.length) return;

        // 🔥 IMPORTANTE:
        // AV1 NO DIFERENCIA POR URL → hay que DUPLICAR

        for (const s of scraped) {

          const u = s.embed || "";

          if (!u.includes("zilla-networks")) continue;

          // 🔥 SUB = LATINO
          latino.push({
            name: "Z",
            type: "embed",
            embed: u,
            lang: "latino"
          });

          // 🔥 DUB = JAPONES
          sub.push({
            name: "Z",
            type: "embed",
            embed: u,
            lang: "sub"
          });
        }

      } catch {}

      // =====================
      // 🟢 JKANIME
      // =====================
      try {

        let servers = await getJKAnimeServers(v, number);

        if (!servers.length) {
          const realSlug = await findJKAnimeSlug(v, env);
          if (realSlug) {
            servers = await getJKAnimeServers(realSlug, number);
          }
        }

        if (!servers.length) return;

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

      } catch {}

    })
  );

  // =====================
  // 🔥 RESULTADO FINAL
  // =====================

  return uniqueServers([
    ...latino,
    ...sub,
    ...jk
  ]).slice(0, 6);
}
