import { getEpisode } from "animeflv-scraper";
import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

// ======================
// 🔥 FETCH AV1 JSON
// ======================
async function fetchAV1Data(slug: string, number: number) {

  const url = `https://animeav1.com/media/${slug}/${number}/__data.json?x-sveltekit-invalidated=1`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept": "application/json",
        "Referer": `https://animeav1.com/media/${slug}/${number}`
      }
    });

    if (!res.ok) return null;

    return await res.json();

  } catch {
    return null;
  }
}

// ======================
// 🔥 PARSER REAL (ROBUSTO)
// ======================
function parseAV1Nodes(json: any) {

  const servers: any[] = [];

  if (!json) return servers;

  const raw = JSON.stringify(json);

  // 🔥 EXTRAER TODAS LAS URLS
  const urls = raw.match(/https?:\/\/[^"\\]+/g) || [];

  for (const url of urls) {

    // 🔥 FILTRO REAL DE SERVERS
    if (
      url.includes("zilla") ||
      url.includes("pixeldrain") ||
      url.includes("mega.nz") ||
      url.includes("mp4upload") ||
      url.includes("1fichier") ||
      url.includes("stream") ||
      url.includes(".m3u8")
    ) {

      servers.push({
        name: "animeav1",
        embed: url,
        type:
          url.includes(".m3u8") || url.includes("zilla")
            ? "hls"
            : "embed",
        lang: raw.includes("DUB") ? "latino" : "sub"
      });
    }
  }

  // 🔥 ELIMINAR DUPLICADOS
  const unique = new Map();

  for (const s of servers) {
    if (!unique.has(s.embed)) {
      unique.set(s.embed, s);
    }
  }

  return Array.from(unique.values());
}

// ======================
// 🔥 ANIMEAV1
// ======================
export async function getAnimeAV1Servers(slug: string, number: number) {

  const json = await fetchAV1Data(slug, number);

  if (json) {

    const parsed = parseAV1Nodes(json);

    if (parsed.length) {
      return parsed;
    }
  }

  return [];
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

        const decoded = Buffer.from(match[1], "base64").toString("utf-8");

        const resolved = await resolveServer(decoded);

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
