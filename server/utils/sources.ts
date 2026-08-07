import { getEpisode } from "animeflv-scraper";
import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

// ======================
// 🔥 HELPERS
// ======================
function isZilla(url: string) {
  return url.includes("zilla-networks");
}

// ======================
// 🔥 SCRAPER AV1 (ZILLA)
// ======================
export async function scrapePage(url: string) {

  try {

    const html = await fetchHtml(url);
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

  } catch {
    return [];
  }
}
