import { getEpisode } from "animeflv-scraper";
import { fetchHtml } from "./fetcher";

// ======================
// 🔥 EXTRAER VIDEO REAL
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

    if (!url || url.includes("facebook") || url.includes("twitter")) {
      return null;
    }

    const html = await fetchHtml(url);
    if (!html) return null;

    const vids = extractVideo(html);

    // 🔥 prioridad HLS
    const hls = vids.find(v => v.includes(".m3u8"));
    if (hls) return hls;

    return vids.length ? vids[0] : null;

  } catch {
    return null;
  }
}

// ======================
// 🔥 JKANIME (DESU + MAGI FIX)
// ======================
export async function getJKAnimeServers(slug: string, number: number) {

  try {

    const html = await fetchHtml(`https://jkanime.net/${slug}/${number}/`);
    if (!html) return [];

    const servers: any[] = [];

    // ==========================
    // 🔥 1. EXTRAER data-player
    // ==========================
    const players = [
      ...html.matchAll(/data-player="([^"]+)"/g)
    ];

    for (const match of players) {

      try {

        const decoded = decodeURIComponent(match[1]);
        const clean = decoded.replace(/\\/g, "");
        const lower = clean.toLowerCase();

        // 🔥 SOLO DESU / MAGI
        if (
          !lower.includes("desu") &&
          !lower.includes("magi")
        ) continue;

        const iframeHtml = await fetchHtml(clean);
        if (!iframeHtml) continue;

        const vids = extractVideo(iframeHtml);

        const hls = vids.find(v => v.includes(".m3u8"));

        if (hls) {
          servers.push({
            name: "jkanime_hls",
            embed: hls
          });
        }

      } catch {}
    }

    // ==========================
    // 🔥 2. FALLBACK SI NO HAY HLS
    // ==========================
    if (!servers.length) {

      for (const match of players) {

        try {

          const decoded = decodeURIComponent(match[1]);
          const clean = decoded.replace(/\\/g, "");

          const real = await resolveIframe(clean);

          if (real) {
            servers.push({
              name: "jkanime_fallback",
              embed: real
            });
          }

        } catch {}
      }
    }

    return servers;

  } catch {
    return [];
  }
}

// ======================
// 🔥 ANIMEFLV (fallback limpio)
// ======================
export async function getAnimeFLVServers(slug: string, number: number) {

  try {

    const res = await getEpisode(slug, number);

    const servers = (res?.servers || []).map((s: any) => ({
      name: s.server || "flv",
      embed: s.url || s.embed
    }));

    return servers.filter(s =>
      s.embed &&
      !s.embed.includes("facebook") &&
      !s.embed.includes("twitter")
    );

  } catch {
    return [];
  }
}
