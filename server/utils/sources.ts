import { getEpisode } from "animeflv-scraper";
import { fetchHtml } from "./fetcher";

// ======================
// 🔥 NORMALIZAR NOMBRE
// ======================
function normalizeServer(name: string) {

  if (!name) return "server";

  const n = name.toLowerCase();

  if (n.includes("yourupload")) return "yourupload";
  if (n.includes("ok")) return "okru";
  if (n.includes("maru")) return "maru";
  if (n.includes("streamwish")) return "streamwish";

  return "server";
}

// ======================
// 🔥 EXTRAER VIDEO REAL
// ======================
function extractVideo(html: string) {

  const urls = new Set<string>();

  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  m3u8?.forEach(u => urls.add(u));

  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  mp4?.forEach(u => urls.add(u));

  return Array.from(urls);
}

// ======================
// 🔥 RESOLVER IFRAME
// ======================
async function resolveIframe(url: string): Promise<string | null> {

  try {
    const html = await fetchHtml(url);
    if (!html) return null;

    const vids = extractVideo(html);

    return vids.length ? vids[0] : null;

  } catch {
    return null;
  }
}

// ======================
// 🔥 DELAY
// ======================
function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

// ======================
// 🔥 JKANIME (FIX PRO)
// ======================
export async function getJKAnimeServers(slug: string, number: number) {

  const servers: any[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {

    try {

      const url = `https://jkanime.net/${slug}/${number}/`;

      const html = await fetchHtml(url);

      if (!html) {
        await delay(500);
        continue;
      }

      // 🔥 1. HLS DIRECTO
      const direct = extractVideo(html);

      for (const d of direct) {
        servers.push({
          name: "jkanime_hls",
          embed: d
        });
      }

      // 🔥 2. IFRAMES REALES
      const frames = [
        ...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)
      ].map(m => m[1]);

      for (const f of frames) {

        // ❌ FILTRAR BASURA
        if (
          f.includes("facebook") ||
          f.includes("twitter") ||
          f.includes("disqus")
        ) continue;

        const real = await resolveIframe(f);

        if (real) {
          servers.push({
            name: "jkanime_embed",
            embed: real
          });
        }
      }

      if (servers.length) break;

    } catch {}

    await delay(800);
  }

  return servers;
}

// ======================
// 🔥 ANIMEFLV
// ======================
export async function getAnimeFLVServers(slug: string, number: number) {

  try {

    const res = await getEpisode(slug, number);

    return (res?.servers || []).map((s: any) => ({
      name: normalizeServer(s.server || s.name),
      embed: s.url || s.embed
    }));

  } catch {
    return [];
  }
}

// ======================
// 🔥 TIOANIME (SOLO FALLBACK)
// ======================
export async function getTioAnimeServers(query: string, number: number) {

  try {

    const html = await fetchHtml(`https://tioanime.com/buscar?q=${query}`);

    const match = html?.match(/href="\/anime\/([^"]+)"/);

    if (!match) return [];

    const ep = await fetchHtml(`https://tioanime.com/ver/${match[1]}-${number}`);

    if (!ep) return [];

    const frames = [
      ...ep.matchAll(/<iframe[^>]+src="([^"]+)"/g)
    ].map(m => m[1]);

    const servers = [];

    for (const f of frames) {

      if (
        f.includes("comment") ||
        f.includes("disqus")
      ) continue;

      const real = await resolveIframe(f);

      if (real) {
        servers.push({
          name: "tioanime",
          embed: real
        });
      }
    }

    return servers;

  } catch {
    return [];
  }
}
