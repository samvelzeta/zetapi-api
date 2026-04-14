import {
  getAnimeFLVServers,
  getJKAnimeServers,
  getAnimeAV1Servers
} from "./sources";

import { filterWorkingServers } from "./filter";
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

  if (url.includes("filemoon")) return 700;
  if (url.includes("streamwish")) return 600;

  return 100;
}

// ======================
function pickBestServers(list: any[], lang: string) {

  let filtered = list;

  // 🔥 FILTRAR POR IDIOMA SI EXISTE
  if (lang) {
    const byLang = list.filter(s => s.lang === lang);
    if (byLang.length) filtered = byLang;
  }

  const sorted = filtered
    .filter(s => s?.embed)
    .sort((a, b) => scoreServer(b) - scoreServer(a));

  const hls = sorted.filter(s => s.embed.includes(".m3u8"));

  if (hls.length) {
    return uniqueServers(hls).slice(0, 3);
  }

  return uniqueServers(sorted).slice(0, 3);
}

// ======================
export async function getAllServers({ slug, number, title, env, lang }: any) {

  const cleanSlug = slug.replace(/-\d+$/, "");

  const variants = [
    ...resolveSlugVariants(cleanSlug),
    ...resolveSlugVariants(slug),
    ...resolveSlugVariants(title || "")
  ];

  let collected: any[] = [];

  // =====================
  // 🥇 1. ANIMEAV1 (__data.json)
  // =====================
  for (const v of variants) {

    try {

      const av1 = await getAnimeAV1Servers(v, number);

      if (av1?.length) {

        const hls = av1.filter(s =>
          s.embed && s.embed.includes(".m3u8")
        );

        // 🔥 SI HAY HLS → SALIDA DIRECTA
        if (hls.length) {
          return pickBestServers(hls, lang);
        }

        collected.push(...av1);
      }

    } catch {}

    if (collected.length >= 5) break;
  }

  // =====================
  // 🥈 2. JKANIME
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

      const hls = jk.filter(s =>
        s.embed && s.embed.includes(".m3u8")
      );

      if (hls.length) {
        return pickBestServers(hls, lang);
      }

      collected.push(...jk);
    }

    if (collected.length >= 6) break;
  }

  // =====================
  // 🥉 3. FALLBACK (FLV)
  // =====================
  try {

    const flv = await getAnimeFLVServers(slug, number);

    if (flv?.length) {
      collected.push(...flv);
    }

  } catch {}

  // =====================
  // 🔥 FILTRADO FINAL
  // =====================
  const filtered = await filterWorkingServers(collected);

  if (!filtered.length) {
    return [];
  }

  return pickBestServers(filtered, lang);
}
