import * as cheerio from "cheerio";
import { resolveServer } from "./resolver";

// ==========================
// ðŸ”¥ FETCH HTML REAL (SIN LOOP)
// ==========================
async function fetchHtml(url: string): Promise<string | null> {

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": new URL(url).origin,
        "Origin": new URL(url).origin
      }
    });

    const text = await res.text();

    return text;
  } catch {
    return null;
  }
}

// ==========================
// ðŸ”¥ EXTRAER IFRAME
// ==========================
function extractIframe(html: string): string[] {

  const $ = cheerio.load(html);
  const iframes: string[] = [];

  $("iframe").each((_, el) => {
    const src = $(el).attr("src");
    if (src) iframes.push(src);
  });

  return iframes;
}

// ==========================
// ðŸ”¥ EXTRAER LINKS
// ==========================
function extractLinks(html: string): string[] {

  const urls: string[] = [];

  const regex = html.match(/https?:\/\/[^"' ]+/g);

  if (regex) {
    for (const u of regex) {
      if (u.length > 30) urls.push(u);
    }
  }

  return urls;
}

// ==========================
// ðŸ”¥ LIMPIAR LINKS
// ==========================
function cleanUrls(urls: string[]): string[] {

  return Array.from(new Set(urls)).filter(u => {

    const bad = [
      ".css",
      ".js",
      "facebook",
      "twitter",
      "ads",
      "doubleclick"
    ];

    return !bad.some(b => u.toLowerCase().includes(b));
  });
}

// ==========================
// ðŸ”¥ RESOLVER
// ==========================
async function resolveAll(urls: string[]) {

  const results = await Promise.allSettled(
    urls.map(u => resolveServer(u))
  );

  return results
    .filter((r: any) => r.status === "fulfilled" && r.value)
    .map((r: any) => r.value);
}

// ==========================
// ðŸ”¥ CREAR SERVERS
// ==========================
function buildServers(urls: string[]) {

  return urls.map((u, i) => ({
    name: `server_${i + 1}`,
    embed: u
  }));
}

// ==========================
// ðŸ”¥ SCRAPER BASE
// ==========================
async function scrapePage(url: string) {

  const html = await fetchHtml(url);
  if (!html) return [];

  const iframes = extractIframe(html);
  const links = extractLinks(html);

  const all = cleanUrls([...iframes, ...links]);

  const resolved = await resolveAll(all);

  return buildServers(resolved);
}

// ==========================
// ðŸ”¥ SOURCES
// ==========================
export async function getAnimeFLVServers(slug: string, number: number) {
  return await scrapePage(`https://www3.animeflv.net/ver/${slug}-${number}`);
}

export async function getJKAnimeServers(slug: string, number: number) {
  return await scrapePage(`https://jkanime.net/${slug}/${number}/`);
}

export async function getLatanimeServers(title: string, number: number) {

  const searchUrl = `https://latanime.org/buscar?q=${encodeURIComponent(title)}`;

  const html = await fetchHtml(searchUrl);
  if (!html) return [];

  const $ = cheerio.load(html);

  const links: string[] = [];

  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (href && href.includes("/anime/")) {
      links.push(href);
    }
  });

  for (const link of links.slice(0, 3)) {

    const epUrl = `${link}/episodio-${number}`;

    const result = await scrapePage(epUrl);

    if (result.length) return result;
  }

  return [];
}

export async function getTioAnimeServers(title: string, number: number) {
  return await scrapePage(`https://tioanime.com/ver/${title}-${number}`);
}

export async function getAnimeYTServers(title: string, number: number) {
  return await scrapePage(`https://animeyt.tv/ver/${title}-${number}`);
}

export async function getAnimeFenixServers(title: string, number: number) {
  return await scrapePage(`https://animefenix.com/ver/${title}-${number}`);
}

export async function getAnimeIDServers(title: string, number: number) {
  return await scrapePage(`https://animeid.tv/${title}-${number}`);
}
