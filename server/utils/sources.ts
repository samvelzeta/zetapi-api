import { getEpisode } from "animeflv-scraper";
import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

// ======================
// 🔥 AV1 SCRAPER SIMPLE
// ======================
export async function getAnimeAV1Servers(slug: string, number: number) {

  const url = `https://animeav1.com/media/${slug}/${number}`;

  try {

    const html = await fetchHtml(url);
    if (!html) return [];

    const urls = html.match(/https?:\/\/[^"' ]+/g) || [];

    const servers: any[] = [];

    for (const u of urls) {

      if (
        u.includes("zilla") ||
        u.includes("pixeldrain") ||
        u.includes("mega.nz") ||
        u.includes("mp4upload") ||
        u.includes("1fichier")
      ) {

        try {

          const resolved = await resolveServer(u);

          servers.push({
            name: "animeav1",
            embed: resolved || u,
            type: u.includes("zilla") ? "hls" : "embed",
            lang: html.includes("DUB") ? "latino" : "sub"
          });

        } catch {}
      }
    }

    // 🔥 quitar duplicados
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
// 🔥 JKANIME
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

        if (resolved) {
          servers.push({
            name: "jkanime",
            embed: resolved,
            lang: "sub"
          });
        }

      } catch {}
    }

    return servers;

  } catch {
    return [];
  }
}

// ======================
// 🔥 ANIMEFLV
// ======================
export async function getAnimeFLVServers(slug: string, number: number) {

  try {

    const data = await getEpisode({ anime: slug, episode: number });

    if (!data?.servers) return [];

    const servers: any[] = [];

    for (const s of data.servers) {

      try {

        const resolved = await resolveServer(s.url);

        if (resolved) {
          servers.push({
            name: "animeflv",
            embed: resolved,
            lang: "sub"
          });
        }

      } catch {}
    }

    return servers;

  } catch {
    return [];
  }
}
