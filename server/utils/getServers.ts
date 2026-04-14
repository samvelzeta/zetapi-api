import {
  getAnimeFLVServers,
  getJKAnimeServers,
  scrapePage
} from "./sources";

import { filterWorkingServers } from "./filter";
import { resolveServer } from "./resolver";
import { resolveSlugVariants } from "./slugResolver";
import { findJKAnimeSlug } from "./jkSearch";
import { getKVVideo } from "./kv";

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
// 🔥 DETECTOR HLS REAL
function isHLS(url: string) {
  return (
    url.includes(".m3u8") ||
    url.includes("playlist") ||
    url.includes("hls") ||
    url.includes("master")
  );
}

// ======================
function normalizeFinalServers(list: any[]) {

  const final: any[] = [];

  for (const s of list) {

    const url = s.embed || "";

    // 🟣 ZILLA (EMBED LIMPIO)
    if (url.includes("zilla-networks")) {
      final.unshift({
        name: "Z",
        type: "embed",
        embed: url
      });
      continue;
    }

    // 🟢 HLS (PRIORIDAD)
    if (isHLS(url)) {
      final.push({
        name: "K",
        type: "hls",
        embed: `${PROXY}${encodeURIComponent(url)}`
      });
      continue;
    }

    // 🔵 RESTO
    final.push({
      name: s.name || "S",
      type: url.includes(".mp4") ? "mp4" : "embed",
      embed: url
    });
  }

  return final.slice(0, 10);
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
  // 🥇 AV1
  // =====================
  for (const v of variants) {

    const url = `https://animeav1.com/media/${v}/${number}`;
    const scraped = await scrapePage(url);

    if (scraped.length) {
      collected.push(...scraped);
    }

    if (collected.length >= 6) break;
  }

  // =====================
  // 🥈 JK
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
    }

    if (collected.length >= 10) break;
  }

  // =====================
  // 🥉 FLV
  // =====================
  const flv = await getAnimeFLVServers(cleanSlug, number);

  if (flv.length) {
    for (const s of flv) {
      const real = await resolveServer(s.embed);
      if (real) {
        collected.push({
          name: "flv",
          embed: real
        });
      }
    }
  }

  // =====================
  // 🧠 KV FALLBACK
  // =====================
  if (!collected.length) {

    const kv = await getKVVideo(cleanSlug, number, lang || "sub", env);

    if (kv?.sources) {
      const servers = [
        ...(kv.sources.hls || []),
        ...(kv.sources.mp4 || []),
        ...(kv.sources.embed || [])
      ].map((u: string) => ({ embed: u }));

      return normalizeFinalServers(servers);
    }

    return [];
  }

  // =====================
  // 🔥 PRIORIDAD TOTAL HLS
  // =====================
  const hlsOnly = collected.filter(s =>
    s.embed && isHLS(s.embed)
  );

  if (hlsOnly.length) {
    const unique = uniqueServers(hlsOnly);
    return normalizeFinalServers(unique);
  }

  // =====================
  // 🔥 FALLBACK NORMAL
  // =====================
  const filtered = await filterWorkingServers(collected);
  const unique = uniqueServers(filtered);

  return normalizeFinalServers(unique);
}
