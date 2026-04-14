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
// 🔥 DETECTAR IDIOMA AV1 (INVERTIDO)
function matchAV1Lang(requested: string, html: string) {

  // AV1:
  // SUB = latino
  // DUB = japonés

  if (requested === "latino") {
    return html.includes('"SUB"');
  }

  return html.includes('"DUB"');
}

// ======================
export async function getAllServers({ slug, number, title, env, lang }: any) {

  const requestedLang = lang === "latino" ? "latino" : "sub";

  const variants = [
    ...resolveSlugVariants(slug),
    ...resolveSlugVariants(title || "")
  ];

  let av1Servers: any[] = [];
  let jkServers: any[] = [];

  // =====================
  // 🔥 BUSQUEDA EN PARALELO
  // =====================
  await Promise.all(

    variants.map(async (v) => {

      // =====================
      // 🟣 AV1
      // =====================
      try {

        const url = `https://animeav1.com/media/${v}/${number}`;
        const scraped = await scrapePage(url);

        if (scraped.length) {

          for (const s of scraped) {

            const u = s.embed || "";

            if (!u.includes("zilla-networks")) continue;

            // 🔥 idioma forzado por request
            if (requestedLang === "latino") {
              av1Servers.push({
                name: "Z",
                type: "embed",
                embed: u,
                lang: "latino"
              });
            } else {
              av1Servers.push({
                name: "Z",
                type: "embed",
                embed: u,
                lang: "sub"
              });
            }
          }
        }

      } catch {}

      // =====================
      // 🟢 JKANIME
      // =====================
      try {

        let jk = await getJKAnimeServers(v, number);

        if (!jk.length) {
          const realSlug = await findJKAnimeSlug(v, env);
          if (realSlug) {
            jk = await getJKAnimeServers(realSlug, number);
          }
        }

        if (jk.length) {

          for (const s of jk) {

            const u = s.embed || "";

            if (!isHLS(u)) continue;

            jkServers.push({
              name: "K",
              type: "hls",
              embed: `${PROXY}${encodeURIComponent(u)}`,
              lang: "sub" // JK normalmente subtitulado
            });
          }
        }

      } catch {}

    })
  );

  // =====================
  // 🔥 PRIORIDAD FINAL
  // =====================

  // 🥇 AV1 primero
  if (av1Servers.length) {
    return uniqueServers([
      ...av1Servers,
      ...jkServers
    ]).slice(0, 5);
  }

  // 🥈 fallback JK
  if (jkServers.length) {
    return uniqueServers(jkServers).slice(0, 5);
  }

  return [];
}
