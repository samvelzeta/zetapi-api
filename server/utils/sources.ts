import * as cheerio from "cheerio";
import { resolveServer } from "./resolver";

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    return await res.text();
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
