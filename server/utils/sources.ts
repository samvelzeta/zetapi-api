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

  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  m3u8?.forEach(u => urls.add(u));

  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  mp4?.forEach(u => urls.add(u));

  const sources = html.match(/file\s*:\s*"([^"]+)"/g);
  sources?.forEach(s => {
    const u = s.match(/"(.*?)"/)?.[1];
    if (u) urls.add(u);
  });

  const jw = html.match(/sources\s*:\s*\[\{file:\s*"([^"]+)"/);
  if (jw?.[1]) urls.add(jw[1]);

  const $ = cheerio.load(html);

  $("iframe").each((_, el) => {
    const src = $(el).attr("src");
    if (src) urls.add(src);
  });

  $("video source").each((_, el) => {
    const src = $(el).attr("src");
    if (src) urls.add(src);
  });

  const links = html.match(/https?:\/\/[^"' ]+/g);
  links?.forEach(u => urls.add(u));

  return Array.from(urls);
}

// ==========================
// 🔥 SCRAPER INTELIGENTE
// ==========================
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

  // 🔥 CLAVE: NO PERDER NADA
  return [...results, ...fallback];
}

// ==========================
// 🔥 MULTI SOURCES REAL
// ==========================
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

    if (res.length) {
      collected.push(...res);
    }
  }

  return collected;
}
