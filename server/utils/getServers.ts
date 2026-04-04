import {
  getAnimeFLVServers,
  getJKAnimeServers
} from "./sources";

import { filterWorkingServers } from "./filter";
import { resolveServer } from "./resolver";
import { resolveSlugVariants } from "./slugResolver";
import { findJKAnimeSlug } from "./jkSearch";

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
function scoreServer(server: any) {

  const url = (server.embed || "").toLowerCase();

  if (url.includes(".m3u8")) return 1000;
  if (url.includes(".mp4")) return 900;

  if (url.includes("desu")) return 880;
  if (url.includes("magi")) return 870;

  if (url.includes("yourupload")) return 800;
  if (url.includes("ok.ru")) return 750;

  if (url.includes("filemoon")) return 700;
  if (url.includes("streamwish")) return 600;

  return 100;
}

// ======================
export async function getAllServers({ slug, number, title, env }: any) {

  const cleanSlug = slug.replace(/-\d+$/, "");

  const variants = [
    ...resolveSlugVariants(cleanSlug),
    ...resolveSlugVariants(slug),
    ...resolveSlugVariants(title || "")
  ];

  let collected: any[] = [];

  // =====================
  // 🥇 JKANIME
  // =====================
  for (const v of variants) {

    let jk = await getJKAnimeServers(v, number);

    // 🔥 BUSQUEDA REAL + KV
    if (!jk.length) {

      const realSlug = await findJKAnimeSlug(v, env);

      if (realSlug) {
        jk = await getJKAnimeServers(realSlug, number);
      }
    }

    if (jk.length) {

      const hls = jk.filter(s =>
        s.embed && s.embed.includes(".m3u8")
      );

      if (hls.length) {
        return uniqueServers(hls).slice(0, 5);
      }

      collected.push(...jk);
    }

    if (collected.length >= 6) break;
  }

  // =====================
  // 🥈 ANIMEFLV
  // =====================
  const flv = await getAnimeFLVServers(cleanSlug, number);

  if (flv.length) {

    const resolved: any[] = [];

    for (const s of flv) {

      const real = await resolveServer(s.embed);

      if (real) {
        resolved.push({
          name: "flv",
          embed: real
        });
      }
    }

    collected.push(...resolved);
  }

  if (!collected.length) return [];

  const filtered = await filterWorkingServers(collected);
  const unique = uniqueServers(filtered);

  return unique.sort((a, b) =>
    scoreServer(b) - scoreServer(a)
  ).slice(0, 10);
}
