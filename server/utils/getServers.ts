import {
  getAnimeFLVServers,
  getJKAnimeServers,
  getAnimeAV1Servers
} from "./sources";

import { filterWorkingServers } from "./filter";
import { resolveSlugVariants } from "./slugResolver";
import { findJKAnimeSlug } from "./jkSearch";

import { getKVVideo, saveKVVideo } from "./kv";

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

  // 🔥 FILTRAR POR IDIOMA
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

  const language = lang === "latino" ? "latino" : "sub";

  // ======================
  // 🧠 1. INTENTO CACHE
  // ======================
  const cached = await getKVVideo(slug, number, language, env);

  if (cached?.servers?.length) {
    return cached.servers;
  }

  const cleanSlug = slug.replace(/-\d+$/, "");

  const variants = [
    ...resolveSlugVariants(cleanSlug),
    ...resolveSlugVariants(slug),
    ...resolveSlugVariants(title || "")
  ];

  let collected: any[] = [];

  // =====================
  // 🥇 2. ANIMEAV1
  // =====================
  for (const v of variants) {

    try {

      const av1 = await getAnimeAV1Servers(v, number);

      if (av1?.length) {

        const hls = av1.filter(s =>
          s.embed && s.embed.includes(".m3u8")
        );

        if (hls.length) {

          const final = pickBestServers(hls, language);

          // 🔥 GUARDAR CACHE
          await saveKVVideo(slug, number, language, {
            servers: final
          }, env);

          return final;
        }

        collected.push(...av1);
      }

    } catch {}

    if (collected.length >= 5) break;
  }

  // =====================
  // 🥈 3. JKANIME
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

        const final = pickBestServers(hls, language);

        await saveKVVideo(slug, number, language, {
          servers: final
        }, env);

        return final;
      }

      collected.push(...jk);
    }

    if (collected.length >= 6) break;
  }

  // =====================
  // 🥉 4. FLV FALLBACK
  // =====================
  try {

    const flv = await getAnimeFLVServers(slug, number);

    if (flv?.length) {
      collected.push(...flv);
    }

  } catch {}

  // =====================
  // 🔥 5. FILTRADO FINAL
  // =====================
  const filtered = await filterWorkingServers(collected);

  if (!filtered.length) {
    return [];
  }

  const final = pickBestServers(filtered, language);

  // 🔥 GUARDAR CACHE FINAL
  await saveKVVideo(slug, number, language, {
    servers: final
  }, env);

  return final;
}
