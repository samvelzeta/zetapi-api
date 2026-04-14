import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

// ======================
// HELPERS
// ======================
function isZilla(url: string) {
  return url.includes("zilla-networks");
}

function isHLS(url: string) {
  return url.includes(".m3u8");
}

// ======================
// 🔥 SCRAPER REAL AV1 (IFRAME + HLS)
// ======================
export async function scrapePage(url: string) {

  try {

    const html = await fetchHtml(url);
    if (!html) return [];

    const servers: any[] = [];

    // ======================
    // 🔥 1. IFRAMES (LO MÁS IMPORTANTE)
    // ======================
    const iframes = [
      ...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)
    ];

    for (const match of iframes) {

      const src = match[1];
      if (!src) continue;

      if (isZilla(src)) {
        servers.push({
          name: "Z",
          embed: src,
          lang: "unknown"
        });
      }
    }

    // ======================
    // 🔥 2. DATA-PLAYER (AVANZADO)
    // ======================
    const players = [
      ...html.matchAll(/data-player="([^"]+)"/g)
    ];

    for (const match of players) {

      try {

        const decoded = decodeURIComponent(match[1]);
        const clean = decoded.replace(/\\/g, "");

        const resolved = await resolveServer(clean);
        if (!resolved) continue;

        if (isHLS(resolved)) {
          servers.push({
            name: "H",
            embed: resolved,
            lang: "unknown"
          });
        }

      } catch {}
    }

    // ======================
    // 🔥 3. HLS DIRECTO
    // ======================
    const hls = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g) || [];

    for (const h of hls) {
      servers.push({
        name: "H",
        embed: h,
        lang: "unknown"
      });
    }

    // ======================
    // 🔥 UNIQUE
    // ======================
    const seen = new Set();

    return servers.filter(s => {
      if (seen.has(s.embed)) return false;
      seen.add(s.embed);
      return true;
    });

  } catch {
    return [];
  }
}

// ======================
// 🔥 JKANIME (DEJAR CASI IGUAL)
// ======================
export async function getJKAnimeServers(slug: string, number: number) {

  try {

    const url = `https://jkanime.net/${slug}/${number}/`;
    const html = await fetchHtml(url);

    if (!html) return [];

    const servers: any[] = [];

    const players = [
      ...html.matchAll(/data-player="([^"]+)"/g)
    ];

    for (const match of players) {

      try {

        const decoded = decodeURIComponent(match[1]);
        const clean = decoded.replace(/\\/g, "");

        const resolved = await resolveServer(clean);
        if (!resolved) continue;

        if (!resolved.includes(".m3u8")) continue;

        servers.push({
          name: "K",
          embed: resolved,
          lang: "sub"
        });

      } catch {}
    }

    return servers;

  } catch {
    return [];
  }
}
