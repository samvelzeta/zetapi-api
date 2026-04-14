import { getEpisode } from "animeflv-scraper";
import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

// ======================
// 🔥 DETECTAR IDIOMA
// ======================
function detectLang(label: string = "") {
  const l = label.toLowerCase();

  if (
    l.includes("latino") ||
    l.includes("español") ||
    l.includes("spanish")
  ) return "latino";

  return "sub";
}

// ======================
// 🔥 AV1 JSON
// ======================
async function fetchAV1Data(slug: string, number: number) {

  const url = `https://animeav1.com/media/${slug}/${number}/__data.json?x-sveltekit-invalidated=1`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
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
// 🔥 EXTRAER HLS JSON
// ======================
function extractAV1(json: any) {

  const servers: any[] = [];

  if (!json) return servers;

  const raw = JSON.stringify(json);

  const m3u8 = raw.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);

  if (m3u8?.length) {
    for (const url of m3u8) {
      servers.push({
        name: "animeav1",
        embed: url,
        type: "hls",
        lang: raw.includes("latino") ? "latino" : "sub"
      });
    }
  }

  return servers;
}

// ======================
// 🔥 ANIMEAV1
// ======================
export async function getAnimeAV1Servers(slug: string, number: number) {

  // 🥇 JSON DIRECTO
  const json = await fetchAV1Data(slug, number);

  if (json) {
    const parsed = extractAV1(json);
    if (parsed.length) return parsed;
  }

  // 🥈 fallback HTML
  try {

    const url = `https://animeav1.com/media/${slug}/${number}`;
    const html = await fetchHtml(url);

    if (!html) return [];

    const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);

    return (m3u8 || []).map(u => ({
      name: "animeav1",
      embed: u,
      type: "hls",
      lang: detectLang(html)
    }));

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

        const decoded = Buffer.from(match[1], "base64").toString("utf-8");

        const resolved = await resolveServer(decoded);

        if (resolved) {
          servers.push({
            name: "jkanime",
            embed: resolved
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
// 🔥 ANIMEFLV (RESTAURADO)
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
            embed: resolved
          });
        }

      } catch {}
    }

    return servers;

  } catch {
    return [];
  }
}
