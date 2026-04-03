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

  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  if (m3u8) return m3u8;

  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  if (mp4) return mp4;

  return [];
}

// ======================
// 🔥 RESOLVER IFRAME
// ======================
async function resolveIframe(url: string): Promise<string | null> {

  const html = await fetchHtml(url);
  if (!html) return null;

  const vids = extractVideo(html);

  if (vids.length) return vids[0];

  return null;
}

// ======================
// 🔥 JKANIME (ULTRA FIX)
// ======================
export async function getJKAnimeServers(slug: string, number: number) {

  try {

    const url = `https://jkanime.net/${slug}/${number}/`;

    const html = await fetchHtml(url);

    if (!html) return [];

    const servers: any[] = [];

    // 🔥 1. HLS DIRECTO
    const direct = extractVideo(html);

    for (const d of direct) {
      servers.push({
        name: "jkanime_hls",
        embed: d
      });
    }

    // 🔥 2. IFRAMES
    const frames = [
      ...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)
    ].map(m => m[1]);

    for (const f of frames) {

      const real = await resolveIframe(f);

      if (real) {
        servers.push({
          name: "jkanime_embed",
          embed: real
        });
      }
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
