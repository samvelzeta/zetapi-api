import {
  getJKAnimeServers,
  getAV1Servers
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
  // 🔥 BUSQUEDA PARALELA
  // =====================
  await Promise.all(

    variants.map(async (v) => {

      // =====================
      // 🟣 AV1 (JSON REAL)
      // =====================
      try {

        const av1 = await getAV1Servers(v, number);

        if (av1) {

          // ✔ SUB = LATINO
          if (av1.latino?.length) {
            for (const s of av1.latino) {
              latino.push({
                name: "Z",
                type: "embed",
                embed: s.embed,
                lang: "latino"
              });
            }
          }

          // ✔ DUB = JAPONES
          if (av1.sub?.length) {
            for (const s of av1.sub) {
              sub.push({
                name: "Z",
                type: "embed",
                embed: s.embed,
                lang: "sub"
              });
            }
          }
        }

      } catch {}

      // =====================
      // 🟢 JKANIME (HLS)
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
  // 🔥 PRIORIDAD FINAL
  // =====================

  // 🥇 AV1 primero (ambos idiomas)
  if (latino.length || sub.length) {
    return uniqueServers([
      ...latino,
      ...sub,
      ...jk
    ]).slice(0, 6);
  }

  // 🥈 fallback JK
  if (jk.length) {
    return uniqueServers(jk).slice(0, 6);
  }

  return [];
}
