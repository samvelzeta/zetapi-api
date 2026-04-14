import { getEpisode } from "animeflv-scraper";
import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

// ======================
// 🔥 EXTRAER URLS GENERICO
// ======================
function extractUrls(html: string) {

  const urls = new Set<string>();

  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  m3u8?.forEach(u => urls.add(u));

  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  mp4?.forEach(u => urls.add(u));

  const iframe = html.match(/<iframe[^>]+src="([^"]+)"/g);
  iframe?.forEach(i => {
    const src = i.match(/src="([^"]+)"/)?.[1];
    if (src) urls.add(src);
  });

  const links = html.match(/https?:\/\/[^"' ]+/g);
  links?.forEach(l => urls.add(l));

  return Array.from(urls);
}

// ======================
// 🔥 DETECTAR HLS EN HTML / JS (LOGICA PYTHON ADAPTADA)
// ======================
function extractHLSDeep(html: string) {

  const results = new Set<string>();

  if (!html) return [];

  // 🔥 m3u8 directos
  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  m3u8?.forEach(u => results.add(u));

  // 🔥 file: "..."
  const file = html.match(/file\s*:\s*"([^"]+)"/g);
  file?.forEach(f => {
    const url = f.match(/"([^"]+)"/)?.[1];
    if (url && url.includes(".m3u8")) results.add(url);
  });

  // 🔥 sources: [{file: "..."}]
  const sources = html.match(/sources\s*:\s*\[[^\]]+\]/g);
  sources?.forEach(block => {
    const urls = block.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
    urls?.forEach(u => results.add(u));
  });

  // 🔥 JSON embebido
  const jsonUrls = html.match(/https?:\/\/[^"' ]+\/playlist[^"' ]+\.m3u8[^"' ]*/g);
  jsonUrls?.forEach(u => results.add(u));

  return Array.from(results);
}

// ======================
// 🔥 ANIMEAV1 EXTRACTOR (NUEVO)
// ======================
export async function getAnimeAV1Servers(slug: string, number: number) {

  const servers: any[] = [];

  const url = `https://animeav1.com/media/${slug}/${number}`;

  try {

    const html = await fetchHtml(url);
    if (!html) return [];

    // ======================
    // 🔥 1. HLS DIRECTO
    // ======================
    const hls = extractHLSDeep(html);

    for (const h of hls) {
      servers.push({
        name: "animeav1",
        embed: h,
        type: "hls",
        lang: detectLang(html)
      });
    }

    // ======================
    // 🔥 2. FALLBACK (EMBEDS)
    // ======================
    const urls = extractUrls(html);

    for (const u of urls) {

      try {

        const resolved = await resolveServer(u);

        if (resolved) {
          servers.push({
            name: "animeav1",
            embed: resolved,
            type: "embed",
            lang: detectLang(html)
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
// 🔥 DETECTAR IDIOMA (LATINO / SUB)
// ======================
function detectLang(html: string): string {

  const lower = html.toLowerCase();

  if (
    lower.includes("latino") ||
    lower.includes("español") ||
    lower.includes("spanish")
  ) return "latino";

  return "sub";
}

// ======================
// 🔥 SCRAPER UNIVERSAL
// ======================
export async function scrapePage(url: string) {

  try {

    const html = await fetchHtml(url);
    if (!html) return [];

    const urls = extractUrls(html);

    const clean = urls.filter(u =>
      u &&
      !u.includes("facebook") &&
      !u.includes("twitter") &&
      !u.includes(".css") &&
      !u.includes(".js") &&
      (
        u.includes("embed") ||
        u.includes("player") ||
        u.includes("video") ||
        u.includes("stream") ||
        u.includes(".m3u8") ||
        u.includes(".mp4")
      )
    );

    const servers: any[] = [];

    for (const u of clean) {

      try {

        const resolved = await resolveServer(u);

        if (resolved) {
          servers.push({
            name: "scraped",
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
// 🔥 JKANIME (SIN TOCAR)
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
