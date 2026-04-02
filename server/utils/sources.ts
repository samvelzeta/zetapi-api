import * as cheerio from "cheerio";
import { resolveServer } from "./resolver";

// ==========================
// 🔥 FETCH ROBUSTO
// ==========================
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*",
        "Referer": url,
        "Origin": new URL(url).origin
      }
    });

    return await res.text();
  } catch {
    return null;
  }
}

// ==========================
// 🔥 EXTRAER TODO POSIBLE
// ==========================
function extractEverything(html: string): string[] {

  const urls = new Set<string>();

  // m3u8 directo
  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  m3u8?.forEach(u => urls.add(u));

  // mp4 directo
  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  mp4?.forEach(u => urls.add(u));

  // iframes
  const $ = cheerio.load(html);
  $("iframe").each((_, el) => {
    const src = $(el).attr("src");
    if (src) urls.add(src);
  });

  // links generales
  const links = html.match(/https?:\/\/[^"' ]+/g);
  links?.forEach(u => urls.add(u));

  return Array.from(urls);
}

// ==========================
// 🔥 SIMULACIÓN DE CLICK
// ==========================
async function simulateClick(url: string): Promise<string[]> {

  const html = await fetchHtml(url);
  if (!html) return [];

  const matches = html.match(/data-player="([^"]+)"/g);

  if (!matches) return [];

  const urls: string[] = [];

  for (const m of matches) {
    const u = m.match(/"(.*?)"/)?.[1];
    if (u) urls.push(u);
  }

  return urls;
}

// ==========================
// 🔥 SCRAPER INTELIGENTE
// ==========================
async function scrapeSmart(url: string) {

  const html = await fetchHtml(url);
  if (!html) return [];

  const extracted = extractEverything(html);

  // 🔥 intentar click virtual
  const clicked = await simulateClick(url);

  const all = [...extracted, ...clicked];

  const resolved = await Promise.allSettled(
    all.map(u => resolveServer(u))
  );

  return resolved
    .filter((r: any) => r.status === "fulfilled" && r.value)
    .map((r: any) => ({
      embed: r.value
    }));
}

// ==========================
// 🔥 MULTI SOURCES
// ==========================
export async function getServersFromAllSources(slug: string, number: number) {

  const urls = [
    `https://www3.animeflv.net/ver/${slug}-${number}`,
    `https://animeflv.ar/ver/${slug}-${number}`,
    `https://animeflv.cyou/ver/${slug}-${number}`,
    `https://jkanime.net/${slug}/${number}/`,
    `https://tioanime.com/ver/${slug}-${number}`
  ];

  const results = await Promise.allSettled(
    urls.map(u => scrapeSmart(u))
  );

  return results
    .filter((r: any) => r.status === "fulfilled")
    .flatMap((r: any) => r.value);
}
