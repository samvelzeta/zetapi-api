import { getEpisode } from "animeflv-scraper";
import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

// ======================
// 🔥 FILTROS REALES
// ======================
function isZilla(url: string) {
  return url.includes("zilla-networks");
}

function isGoodHLS(url: string) {
  return (
    url.includes(".m3u8") &&
    !url.includes("mp4upload") &&
    !url.includes("mega") &&
    !url.includes("1fichier")
  );
}

// ======================
// 🔥 SCRAPER AV1 LIMPIO (SOLO ZILLA)
// ======================
export async function scrapePage(url: string) {

  try {

    const html = await fetchHtml(url);
    if (!html) return [];

    const urls = html.match(/https?:\/\/[^"' ]+/g) || [];

    const servers: any[] = [];

    for (const u of urls) {

      // 🔥 SOLO ZILLA (LO IMPORTANTE)
      if (!isZilla(u)) continue;

      servers.push({
        name: "animeav1",
        embed: u
      });
    }

    // 🔥 UNIQUE
    const unique = new Map();

    for (const s of servers) {
      if (!unique.has(s.embed)) {
        unique.set(s.embed, s);
      }
    }

    return Array.from(unique.values());

  } catch {
    return [];
  }
}

// ======================
// 🔥 JKANIME (SOLO HLS REAL)
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

        // 🔥 SOLO HLS REAL
        if (!isGoodHLS(resolved)) continue;

        servers.push({
          name: "jkanime",
          embed: resolved
        });

      } catch {}
    }

    // 🔥 UNIQUE
    const unique = new Map();

    for (const s of servers) {
      if (!unique.has(s.embed)) {
        unique.set(s.embed, s);
      }
    }

    return Array.from(unique.values());

  } catch {
    return [];
  }
}

// ======================
// 🔥 ANIMEFLV (OPCIONAL)
// ======================
export async function getAnimeFLVServers(slug: string, number: number) {

  try {

    const data = await getEpisode({ anime: slug, episode: number });

    if (!data?.servers) return [];

    const servers: any[] = [];

    for (const s of data.servers) {

      try {

        const resolved = await resolveServer(s.url);

        if (!resolved) continue;

        // 🔥 SOLO HLS
        if (!isGoodHLS(resolved)) continue;

        servers.push({
          name: "animeflv",
          embed: resolved
        });

      } catch {}
    }

    return servers;

  } catch {
    return [];
  }
}
