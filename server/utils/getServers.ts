import {
  getAnimeFLVServers,
  getJKAnimeServers,
  getAnimeAV1Servers
} from "./sources";

import { filterWorkingServers } from "./filter";
import { resolveSlugVariants } from "./slugResolver";
import { findJKAnimeSlug } from "./jkSearch";
import { getKVVideo } from "./kv";

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
export async function getAllServers({ slug, number, title, env, lang }: any) {

  const language = lang === "latino" ? "latino" : "sub";

  // 🧠 CACHE
  const cached = await getKVVideo(slug, number, language, env);
  if (cached?.servers?.length) return cached.servers;

  const variants = [
    ...resolveSlugVariants(slug),
    ...resolveSlugVariants(title || "")
  ];

  let collected: any[] = [];

  // =====================
  // 🥇 ANIMEAV1 (PRIORIDAD REAL)
  // =====================
  for (const v of variants) {

    const av1 = await getAnimeAV1Servers(v, number);

    if (av1.length) {

      const hls = av1.filter(s =>
        s.embed.includes(".m3u8") ||
        s.embed.includes("zilla")
      );

      if (hls.length) {
        return uniqueServers(hls).slice(0, 3);
      }

      collected.push(...av1);
    }
  }

  // =====================
  // 🥈 JKANIME
  // =====================
  for (const v of variants) {

    let jk = await getJKAnimeServers(v, number);

    if (!jk.length) {
      const realSlug = await findJKAnimeSlug(v, env);
      if (realSlug) {
        jk = await getJKAnimeServers(realSlug, number);
      }
    }

    if (jk.length) {
      collected.push(...jk);
      break;
    }
  }

  // =====================
  // 🥉 FLV
  // =====================
  const flv = await getAnimeFLVServers(slug, number);
  collected.push(...flv);

  // =====================
  // FINAL
  // =====================
  const filtered = await filterWorkingServers(collected);

  return uniqueServers(filtered).slice(0, 5);
}
