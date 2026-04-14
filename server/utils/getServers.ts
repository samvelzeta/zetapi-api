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
// 🔥 PROXY GLOBAL (CORRECTO)
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
function scoreServer(server: any) {
  const url = (server.embed || "").toLowerCase();

  if (url.includes(".m3u8")) return 1000;
  if (url.includes(".mp4")) return 900;
  if (url.includes("filemoon")) return 700;
  if (url.includes("streamwish")) return 600;

  return 100;
}

// ======================
// 🔥 APLICAR PROXY GLOBAL (FIX REAL)
function applyProxy(servers: any[]) {
  return servers.map(s => ({
    ...s,
    embed: `${PROXY}${encodeURIComponent(s.embed)}`
  }));
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
  // 🥇 AV1 SCRAPER
  // =====================
  for (const v of variants) {

    const url = `https://animeav1.com/media/${v}/${number}`;
    const scraped = await scrapePage(url);

    if (scraped.length) {

      const hls = scraped.filter(s =>
        s.embed && s.embed.includes(".m3u8")
      );

      if (hls.length) {
        return applyProxy(uniqueServers(hls).slice(0, 5));
      }

      collected.push(...scraped);
    }

    if (collected.length >= 5) break;
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

      const hls = jk.filter(s =>
        s.embed && s.embed.includes(".m3u8")
      );

      if (hls.length) {
        return applyProxy(uniqueServers(hls).slice(0, 5));
      }

      collected.push(...jk);
    }

    if (collected.length >= 6) break;
  }

  // =====================
  // 🥉 FLV
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

      return applyProxy(servers);
    }

    return [];
  }

  const filtered = await filterWorkingServers(collected);
  const unique = uniqueServers(filtered);

  return applyProxy(
    unique
      .sort((a, b) => scoreServer(b) - scoreServer(a))
      .slice(0, 10)
  );
}
