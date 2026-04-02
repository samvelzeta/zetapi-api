import * as cheerio from "cheerio";
import { resolveServer } from "./resolver";

// ==========================
// 🔥 FETCH ROBUSTO
// ==========================x
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

  // 🔥 NUEVO: sources file:
  const sources = html.match(/file\s*:\s*"([^"]+)"/g);
  sources?.forEach(s => {
    const u = s.match(/"(.*?)"/)?.[1];
    if (u) urls.add(u);
  });

  // 🔥 NUEVO: jwplayer sources
  const jw = html.match(/sources\s*:\s*\[\{file:\s*"([^"]+)"/);
  if (jw?.[1]) urls.add(jw[1]);

  // iframes
  const $ = cheerio.load(html);
  $("iframe").each((_, el) => {
    const src = $(el).attr("src");
    if (src) urls.add(src);
  });

  // 🔥 NUEVO: video tags
  $("video source").each((_, el) => {
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

  // 🔥 NUEVO: eliminar duplicados antes de resolver
  const unique = Array.from(new Set(all));

  const resolved = await Promise.allSettled(
    unique.map(u => resolveServer(u))
  );

  const results = resolved
    .filter((r: any) => r.status === "fulfilled" && r.value)
    .map((r: any) => ({
      embed: r.value
    }));

  // 🔥 NUEVO: fallback si no resolvió nada → devolver links crudos
  if (!results.length) {
    return unique.slice(0, 3).map(u => ({ embed: u }));
  }

  return results;
}

// ==========================
// 🔥 MULTI SOURCES (MEJORADO)
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

  // 🔥 PROCESO SECUENCIAL INTELIGENTE
  for (const url of urls) {

    const res = await scrapeSmart(url);

    if (res.length) {
      collected.push(...res);

      // 🔥 si ya tenemos suficientes resultados → parar
      if (collected.length >= 5) break;
    }
  }

  // 🔥 fallback final (por si todo falla)
  if (!collected.length) {
    const results = await Promise.allSettled(
      urls.map(u => scrapeSmart(u))
    );

    return results
      .filter((r: any) => r.status === "fulfilled")
      .flatMap((r: any) => r.value);
  }

  return collected;
}
