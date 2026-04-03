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
// 🔥 EXTRAER PLAYERS DESU / MAGI
// ======================
function extractJKPlayers(html: string) {

  const players: string[] = [];

  // 🔥 data-player (nuevo)
  const dataPlayers = [
    ...html.matchAll(/data-player="([^"]+)"/g)
  ];

  for (const match of dataPlayers) {
    try {
      const decoded = decodeURIComponent(match[1]);
      const clean = decoded.replace(/\\/g, "");
      players.push(clean);
    } catch {}
  }

  // 🔥 iframe directo
  const iframes = [
    ...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)
  ].map(m => m[1]);

  for (const f of iframes) {

    if (
      f.includes("facebook") ||
      f.includes("twitter") ||
      f.includes("disqus") ||
      f.includes("ads")
    ) continue;

    players.push(f);
  }

  return players;
}

// ======================
// 🔥 JKANIME (DESU + MAGI REAL FIX)
// ======================
export async function getJKAnimeServers(slug: string, number: number) {

  const servers: any[] = [];

  try {

    const url = `https://jkanime.net/${slug}/${number}/`;
    const html = await fetchHtml(url);

    if (!html) return [];

    const players = extractJKPlayers(html);

    for (const p of players) {

      const lower = p.toLowerCase();

      // 🔥 SOLO DESU / MAGI (PRIORIDAD REAL)
      if (
        !lower.includes("desu") &&
        !lower.includes("magi")
      ) continue;

      const real = await resolveIframe(p);

      if (real && real.includes(".m3u8")) {
        servers.push({
          name: "jkanime_hls",
          embed: real
        });
      }
    }

    // ======================
    // 🔥 SI NO HAY DESU/MAGI → fallback
    // ======================
    if (!servers.length) {

      for (const p of players) {

        const real = await resolveIframe(p);

        if (real) {
          servers.push({
            name: "jkanime_fallback",
            embed: real
          });
        }
      }
    }

  } catch {}

  return servers;
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

    // 🔥 limpiar basura
    return servers.filter(s =>
      s.embed &&
      !s.embed.includes("facebook") &&
      !s.embed.includes("twitter")
    );

  } catch {
    return [];
  }
}
