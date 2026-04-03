import * as cheerio from "cheerio";
import { resolveServer } from "./resolver";

// ==========================
// 🔥 FETCH ROBUSTO (NO TOCAR)
// ==========================
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

    return await res.text();
  } catch {
    return null;
  }
}

// ==========================
// 🔥 EXTRAER TODO (MODO VIEJO)
// ==========================
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

// ==========================
// 🔥 JKANIME PRO (DESU + MAGI + FALLBACK)
// ==========================
export async function getJKAnimeServers(slug: string, number: number) {

  try {

    const url = `https://jkanime.net/${slug}/${number}/`;
    const html = await fetchHtml(url);

    if (!html) return [];

    const urls = extractAll(html);

    const resolved = await Promise.allSettled(
      urls.map(u => resolveServer(u))
    );

    const results = resolved
      .filter((r: any) => r.status === "fulfilled" && r.value)
      .map((r: any) => r.value);

    return results.map(u => ({
      name: u.includes(".m3u8") ? "jkanime_hls" : "jkanime",
      embed: u
    }));

  } catch {
    return [];
  }
}

// ==========================
// 🔥 ANIMEFLV (backup)
// ==========================
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
