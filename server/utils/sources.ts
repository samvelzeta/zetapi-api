import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

// ======================
// 🔥 HELPERS
// ======================
function isZilla(url: string) {
  return url.includes("zilla-networks");
}

function extractHLS(block: string) {
  return block.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g) || [];
}

// ======================
// 🔥 AV1 SCRAPER PRO
// ======================
export async function scrapePage(url: string) {

  try {

    const html = await fetchHtml(url);
    if (!html) return [];

    const servers: any[] = [];

    // ======================
    // 🟢 SUB (LATINO)
    // ======================
    const subBlock = html.split("SUB")[1]?.split("DUB")[0] || "";

    const subHLS = extractHLS(subBlock);

    for (const u of subHLS) {
      if (isZilla(u)) {
        servers.push({
          name: "animeav1",
          embed: u,
          lang: "latino"
        });
      }
    }

    // ======================
    // 🔵 DUB (JAPONES)
    // ======================
    const dubBlock = html.split("DUB")[1] || "";

    const dubHLS = extractHLS(dubBlock);

    for (const u of dubHLS) {
      if (isZilla(u)) {
        servers.push({
          name: "animeav1",
          embed: u,
          lang: "sub"
        });
      }
    }

    // ======================
    // 🔥 UNIQUE REAL
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
// 🔥 JKANIME (HLS REAL)
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
          name: "jkanime",
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
