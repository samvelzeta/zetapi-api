import * as cheerio from "cheerio";
import { resolveServer } from "./resolver";

// ======================
// 🔥 FETCH REALISTA
// ======================
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": new URL(url).origin,
        "Origin": new URL(url).origin
      }
    });

    const text = await res.text();
    if (!text || text.length < 800) return null;

    return text;

  } catch {
    return null;
  }
}

// ======================
// 🔥 EXTRAER TODO (MODO VIEJO)
// ======================
function extractAll(html: string): string[] {

  const urls = new Set<string>();

  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  m3u8?.forEach(u => urls.add(u));

  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  mp4?.forEach(u => urls.add(u));

  const $ = cheerio.load(html);

  $("iframe").each((_, el) => {
    const src = $(el).attr("src");
    if (src) urls.add(src);
  });

  const links = html.match(/https?:\/\/[^"' ]+/g);
  links?.forEach(u => urls.add(u));

  return Array.from(urls);
}

// ======================
// 🔥 EXTRAER DESU / MAGI
// ======================
async function extractDesuMagi(html: string) {

  const results: string[] = [];

  const players = [
    ...html.matchAll(/data-player="([^"]+)"/g)
  ];

  for (const match of players) {

    try {

      const decoded = decodeURIComponent(match[1]);
      const clean = decoded.replace(/\\/g, "").toLowerCase();

      // 🔥 SOLO DESU / MAGI
      if (!clean.includes("desu") && !clean.includes("magi")) continue;

      const iframeHtml = await fetchHtml(clean);
      if (!iframeHtml) continue;

      const m3u8 = iframeHtml.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/);

      if (m3u8) {
        results.push(m3u8[0]);
      }

    } catch {}
  }

  return results;
}

// ======================
// 🔥 JKANIME FINAL (COMBINADO)
// ======================
export async function getJKAnimeServers(slug: string, number: number) {

  try {

    const url = `https://jkanime.net/${slug}/${number}/`;
    const html = await fetchHtml(url);

    if (!html) return [];

    let servers: any[] = [];

    // ==========================
    // 🥇 INTENTO DESU / MAGI
    // ==========================
    const hlsList = await extractDesuMagi(html);

    if (hlsList.length) {
      servers.push(
        ...hlsList.map(u => ({
          name: "jkanime_hls",
          embed: u
        }))
      );
    }

    // ==========================
    // 🥈 FALLBACK MODO VIEJO
    // ==========================
    const allUrls = extractAll(html);

    const resolved = await Promise.allSettled(
      allUrls.map(u => resolveServer(u))
    );

    const fallback = resolved
      .filter((r: any) => r.status === "fulfilled" && r.value)
      .map((r: any) => r.value);

    servers.push(
      ...fallback.map(u => ({
        name: "jkanime",
        embed: u
      }))
    );

    return servers;

  } catch {
    return [];
  }
}

// ======================
// 🔥 ANIMEFLV (BACKUP)
// ======================
export async function getAnimeFLVServers(slug: string, number: number) {

  try {

    const html = await fetchHtml(
      `https://www3.animeflv.net/ver/${slug}-${number}`
    );

    if (!html) return [];

    const urls = extractAll(html);

    const resolved = await Promise.allSettled(
      urls.map(u => resolveServer(u))
    );

    return resolved
      .filter((r: any) => r.status === "fulfilled" && r.value)
      .map((r: any) => ({
        name: "flv",
        embed: r.value
      }));

  } catch {
    return [];
  }
}
