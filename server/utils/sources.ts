import { getEpisode } from "animeflv-scraper";
import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

// ======================
// 🔥 EXTRAER URLS
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

  const links = html.match(/https?:\/\/[^"' ]+/g);
  links?.forEach(l => urls.add(l));

  return Array.from(urls);
}

// ======================
// 🔥 SCRAPER UNIVERSAL
// ======================
export async function scrapePage(url: string) {

  try {

    const html = await fetchHtml(url);
    if (!html) return [];

    const urls = extractUrls(html);

    const clean = urls.filter(u =>
      u &&
      !u.includes("facebook") &&
      !u.includes("twitter") &&
      !u.includes(".css") &&
      !u.includes(".js") &&
      (
        u.includes("embed") ||
        u.includes("player") ||
        u.includes("video") ||
        u.includes("stream") ||
        u.includes(".m3u8") ||
        u.includes(".mp4")
      )
    );

    const servers: any[] = [];

    for (const u of clean) {

      try {

        const resolved = await resolveServer(u);

        if (resolved) {
          servers.push({
            name: "scraped",
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

// ======================
// 🔥 JKANIME
// ======================
export async function getJKAnimeServers(slug: string, number: number) {

  try {

    const url = `https://jkanime.net/${slug}/${number}/`;
    const html = await fetchHtml(url);

    if (!html) return [];

    const servers: any[] = [];

    // 🔥 detectar players (DESU / MAGI / etc)
    const players = [
      ...html.matchAll(/data-player="([^"]+)"/g)
    ];

    for (const match of players) {

      try {

        const decoded = decodeURIComponent(match[1]);
        const clean = decoded.replace(/\\/g, "");

        const resolved = await resolveServer(clean);

        if (resolved) {
          servers.push({
            name: "jkanime",
            embed: resolved
          });
        }

      } catch {}
    }

    // 🔥 fallback con scrape completo
    if (!servers.length) {
      return await scrapePage(url);
    }

    return servers;

  } catch {
    return [];
  }
}

// ======================
// 🔥 ANIMEFLV
// ======================
export async function getAnimeFLVServers(slug: string, number: number) {

  try {

    const res = await getEpisode(slug, number);

    return (res?.servers || []).map((s: any) => ({
      name: s.server || "flv",
      embed: s.url || s.embed
    }));

  } catch {
    return [];
  }
}
