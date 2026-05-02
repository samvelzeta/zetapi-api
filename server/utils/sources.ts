import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

// ======================
// 🔥 HELPERS
// ======================
function isZilla (url: string) {
  return url.includes("zilla-networks");
}

// ======================
// 🔥 SCRAPER AV1 (ZILLA)
// ======================
export async function scrapePage (url: string) {
  try {
    const html = await fetchHtml(url, {
      timeoutMs: 3500,
      retries: 0,
      minLength: 80
    });
    if (!html) return [];

    const urls = html.match(/https?:\/\/[^"' ]+/g) || [];

    const servers: any[] = [];

    for (const u of urls) {
      if (!isZilla(u)) continue;

      servers.push({
        name: "animeav1",
        embed: u
      });
    }

    const unique = new Map();

    for (const s of servers) {
      if (!unique.has(s.embed)) {
        unique.set(s.embed, s);
      }
    }

    return Array.from(unique.values());
  }
  catch {
    return [];
  }
}

// ======================
// 🔥 JKANIME (FIX REAL)
// ======================
export async function getJKAnimeServers (slug: string, number: number) {
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

        // 🔥 SOLO HLS (SIN FILTROS ROTOS)
        if (!resolved.includes(".m3u8")) continue;

        servers.push({
          name: "jkanime",
          embed: resolved
        });
      }
      catch {
        continue;
      }
    }

    const unique = new Map();

    for (const s of servers) {
      if (!unique.has(s.embed)) {
        unique.set(s.embed, s);
      }
    }

    return Array.from(unique.values());
  }
  catch {
    return [];
  }
}
