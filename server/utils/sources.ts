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

  return Array.from(urls);
}

// ======================
// 🔥 DETECTAR IDIOMA
// ======================
function detectLangFromLabel(label: string = ""): string {

  const l = label.toLowerCase();

  if (
    l.includes("latino") ||
    l.includes("español") ||
    l.includes("spanish")
  ) return "latino";

  return "sub";
}

// ======================
// 🔥 FETCH JSON AV1 (CLAVE TOTAL)
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

    const json = await res.json();

    return json;

  } catch {
    return null;
  }
}

// ======================
// 🔥 EXTRAER SERVERS DESDE JSON
// ======================
function extractServersFromJSON(json: any) {

  const servers: any[] = [];

  if (!json) return servers;

  try {

    const raw = JSON.stringify(json);

    // 🔥 BUSCAR HLS DIRECTOS
    const m3u8 = raw.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);

    if (m3u8?.length) {
      for (const url of m3u8) {
        servers.push({
          name: "animeav1",
          embed: url,
          type: "hls",
          lang: "sub" // se ajusta luego
        });
      }
    }

    // 🔥 EXTRAER POSIBLE INFO DE IDIOMA
    if (raw.includes("latino")) {
      servers.forEach(s => (s.lang = "latino"));
    }

  } catch {}

  return servers;
}

// ======================
// 🔥 FALLBACK HTML (SI JSON FALLA)
// ======================
function extractHLSFromHTML(html: string) {

  const results = new Set<string>();

  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  m3u8?.forEach(u => results.add(u));

  return Array.from(results);
}

// ======================
// 🔥 ANIMEAV1 (FINAL PRO)
// ======================
export async function getAnimeAV1Servers(slug: string, number: number) {

  const servers: any[] = [];

  // ======================
  // 🥇 1. INTENTO JSON
  // ======================
  const json = await fetchAV1Data(slug, number);

  if (json) {

    const parsed = extractServersFromJSON(json);

    if (parsed.length) {
      return parsed;
    }
  }

  // ======================
  // 🥈 2. FALLBACK HTML
  // ======================
  const url = `https://animeav1.com/media/${slug}/${number}`;

  try {

    const html = await fetchHtml(url);
    if (!html) return [];

    const hls = extractHLSFromHTML(html);

    for (const h of hls) {
      servers.push({
        name: "animeav1",
        embed: h,
        type: "hls",
        lang: detectLangFromLabel(html)
      });
    }

    const urls = extractUrls(html);

    for (const u of urls) {

      try {

        const resolved = await resolveServer(u);

        if (resolved) {
          servers.push({
            name: "animeav1",
            embed: resolved,
            type: "embed",
            lang: detectLangFromLabel(html)
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
