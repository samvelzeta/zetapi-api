import { getEpisode } from "animeflv-scraper";
import { $fetch } from "ofetch";

// ======================
// 🔥 NORMALIZAR SERVIDOR
// ======================
function normalizeServer(name: string) {
  if (!name) return "server";

  const n = name.toLowerCase();

  if (n.includes("streamwish") || n.includes("sw")) return "streamwish";
  if (n.includes("filemoon")) return "filemoon";
  if (n.includes("streamtape")) return "streamtape";
  if (n.includes("mp4")) return "mp4upload";
  if (n.includes("okru") || n.includes("ok.ru")) return "okru";
  if (n.includes("netu")) return "netu";
  if (n.includes("dood")) return "dood";

  return "server";
}

// =====================
// 🔥 EXTRAER VIDEO REAL
// =====================
function extractVideoAdvanced(html: string) {

  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  if (m3u8) return m3u8[0];

  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  if (mp4) return mp4[0];

  const source = html.match(/file\s*:\s*"([^"]+)"/);
  if (source) return source[1];

  return null;
}

// =====================
// 🔥 RESOLVER PROFUNDO
// =====================
async function deepResolve(url: string, depth = 0): Promise<string | null> {

  if (depth > 3) return null;

  try {

    const html = await $fetch(url, { timeout: 6000 });

    const video = extractVideoAdvanced(html);
    if (video) return video;

    const frames = [...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)].map(m => m[1]);

    for (const f of frames) {
      const res = await deepResolve(f, depth + 1);
      if (res) return res;
    }

    return null;

  } catch {
    return null;
  }
}

// =====================
// 🔥 LATINO
// =====================
export async function getTioAnimeServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://tioanime.com/buscar?q=${query}`);
    const match = search.match(/href="\/anime\/([^"]+)"/);
    if (!match) return [];

    const ep = await $fetch(`https://tioanime.com/ver/${match[1]}-${number}`);

    const frames = [...ep.matchAll(/<iframe[^>]+src="([^"]+)"/g)].map(m => m[1]);

    const servers = [];

    for (const f of frames) {
      const real = await deepResolve(f);
      if (real) {
        servers.push({
          name: normalizeServer(real),
          embed: real
        });
      }
    }

    return servers;

  } catch {
    return [];
  }
}

// =====================
// 🔥 SUB (LIMPIO)
// =====================
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

// =====================
// 🔥 JKANIME (ARREGLADO)
// =====================
export async function getJKAnimeServers(slug: string, number: number) {
  try {

    const html = await $fetch(`https://jkanime.net/${slug}/${number}/`);

    if (!html) return [];

    const servers: any[] = [];

    // 🔥 SOLO VIDEOS REALES
    const matches = html.match(/https?:\/\/[^"' ]+\.(m3u8|mp4)[^"' ]*/g);

    if (matches) {
      for (const m of matches) {
        servers.push({
          name: "jkanime",
          embed: m
        });
      }
    }

    return servers;

  } catch {
    return [];
  }
}
