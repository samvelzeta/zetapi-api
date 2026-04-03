import { getEpisode } from "animeflv-scraper";
import { fetchHtml } from "./fetcher";

// ======================
// 🔥 EXTRAER VIDEO
// ======================
function extractVideo(html: string) {

  const urls = new Set<string>();

  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  m3u8?.forEach(u => urls.add(u));

  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  mp4?.forEach(u => urls.add(u));

  return Array.from(urls);
}

// ======================
// 🔥 RESOLVER IFRAME
// ======================
async function resolveIframe(url: string) {

  try {
    const html = await fetchHtml(url);
    if (!html) return null;

    const vids = extractVideo(html);
    return vids.length ? vids[0] : null;

  } catch {
    return null;
  }
}

// ======================
// 🔥 JKANIME (DESU + MAGI FIX REAL)
// ======================
export async function getJKAnimeServers(slug: string, number: number) {

  const servers: any[] = [];

  try {

    const url = `https://jkanime.net/${slug}/${number}/`;
    const html = await fetchHtml(url);

    if (!html) return [];

    // ======================
    // 🔥 1. BUSCAR DESU / MAGI
    // ======================
    const playerMatches = [
      ...html.matchAll(/data-player="([^"]+)"/g)
    ];

    for (const match of playerMatches) {

      try {

        const decoded = decodeURIComponent(match[1]);
        const playerUrl = decoded.replace(/\\/g, "");

        const real = await resolveIframe(playerUrl);

        if (real) {
          servers.push({
            name: "jkanime_hls",
            embed: real
          });
        }

      } catch {}
    }

    // ======================
    // 🔥 2. FALLBACK (iframes normales)
    // ======================
    const frames = [
      ...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)
    ].map(m => m[1]);

    for (const f of frames) {

      if (
        f.includes("facebook") ||
        f.includes("twitter") ||
        f.includes("disqus")
      ) continue;

      const real = await resolveIframe(f);

      if (real) {
        servers.push({
          name: "jkanime_embed",
          embed: real
        });
      }
    }

  } catch {}

  return servers;
}

// ======================
// 🔥 ANIMEFLV
// ======================
export async function getAnimeFLVServers(slug: string, number: number) {

  try {

    const res = await getEpisode(slug, number);

    return (res?.servers || []).map((s: any) => ({
      name: s.server || "flv",
      embed: s.url || s.embed
    }));

  } catch {
    return [];
  }
}
