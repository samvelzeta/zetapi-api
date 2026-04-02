import * as cheerio from "cheerio";
import { resolveServer } from "./resolver";

// ==========================
// 🔥 FETCH ROBUSTO
// ==========================
async function fetchHtml(url: string): Promise<string | null> {

  try {

    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/118 Safari/537.36"
    ];

    const ua = userAgents[Math.floor(Math.random() * userAgents.length)];

    const res = await fetch(url, {
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
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

// ==========================
// 🔥 DELAY HUMANO
// ==========================
function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

// ==========================
// 🔥 EXTRAER LINKS ÚTILES
// ==========================
function extractEverything(html: string): string[] {

  const urls = new Set<string>();

  const matches = html.match(/https?:\/\/[^"' ]+/g);
  if (!matches) return [];

  for (const u of matches) {

    const clean = u.toLowerCase();

    if (
      clean.includes(".m3u8") ||
      clean.includes(".mp4") ||
      clean.includes("embed") ||
      clean.includes("player")
    ) {
      urls.add(u);
    }
  }

  const $ = cheerio.load(html);

  $("iframe").each((_, el) => {
    const src = $(el).attr("src");
    if (src) urls.add(src);
  });

  return Array.from(urls);
}

// ==========================
// 🔥 SCRAPER
// ==========================
async function scrapeSmart(url: string) {

  await delay(200 + Math.random() * 500);

  const html = await fetchHtml(url);
  if (!html) return [];

  const extracted = extractEverything(html);
  const unique = Array.from(new Set(extracted));

  const resolved = await Promise.allSettled(
    unique.map(u => resolveServer(u))
  );

  const results: any[] = [];

  for (const r of resolved) {
    if (r.status === "fulfilled" && r.value) {
      results.push({ embed: r.value });
    }
  }

  return results;
}

// ==========================
// 🔥 MULTI SOURCES (PARALELO)
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
