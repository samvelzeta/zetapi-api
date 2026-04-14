import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

// ======================
// 🔥 HELPERS
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
// 🔥 AV1 SCRAPER REAL (CON IDIOMA)
// ======================
export async function scrapePage(url: string) {

  try {

    const html = await fetchHtml(url);
    if (!html) return [];

    const servers: any[] = [];

    // ======================
    // 🟢 SUB = LATINO
    // ======================
    const subBlock = html.split("SUB")[1]?.split("DUB")[0] || "";

    const subUrls = subBlock.match(/https?:\/\/[^"' ]+/g) || [];

    for (const u of subUrls) {
      if (isZilla(u)) {
        servers.push({
          name: "animeav1",
          embed: u,
          lang: "latino"
        });
      }
    }

    // ======================
    // 🔵 DUB = JAPONES
    // ======================
    const dubBlock = html.split("DUB")[1] || "";

    const dubUrls = dubBlock.match(/https?:\/\/[^"' ]+/g) || [];

    for (const u of dubUrls) {
      if (isZilla(u)) {
        servers.push({
          name: "animeav1",
          embed: u,
          lang: "sub"
        });
      }
    }

    // ======================
    // 🔥 UNIQUE
    // ======================
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

        if (!isGoodHLS(resolved)) continue;

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
