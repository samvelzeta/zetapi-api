import * as cheerio from "cheerio";
import { resolveServer } from "./resolver";

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
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Referer": new URL(url).origin,
        "Origin": new URL(url).origin
      }
    });

    const text = await res.text();

    if (!text || text.length < 1000) return null;

    return text;

  } catch {
    return null;
  }
}

function extractEverything(html: string): string[] {

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

  return Array.from(urls);
}

async function scrapeSmart(url: string) {

  const html = await fetchHtml(url);
  if (!html) return [];

  const extracted = extractEverything(html);
  const unique = Array.from(new Set(extracted));

  const resolved = await Promise.allSettled(
    unique.map(u => resolveServer(u))
  );

  const results: any[] = [];
  const fallback: any[] = [];

  for (let i = 0; i < resolved.length; i++) {
    const r = resolved[i];

    if (r.status === "fulfilled" && r.value) {
      results.push({ embed: r.value });
    } else {
      fallback.push({ embed: unique[i] });
    }
  }

  return [...results, ...fallback];
}

export async function getServersFromAllSources(slug: string, number: number) {

  const urls = [
    `https://www3.animeflv.net/ver/${slug}-${number}`,
    `https://animeflv.ar/ver/${slug}-${number}`,
    `https://animeflv.cyou/ver/${slug}-${number}`,
    `https://jkanime.net/${slug}/${number}/`,
    `https://tioanime.com/ver/${slug}-${number}`
  ];

  let collected: any[] = [];

  for (const url of urls) {
    const res = await scrapeSmart(url);
    if (res.length) collected.push(...res);
  }

  return collected;
}
