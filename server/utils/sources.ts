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
// 🔥 EXTRAER IFRAMES
// =====================
function extractIframes(html: string) {
  return [...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)].map(m => m[1]);
}

// =====================
// 🔥 EXTRACTOR PRO
// =====================
function extractVideoAdvanced(html: string) {

  // 🥇 m3u8
  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  if (m3u8) return m3u8[0];

  // 🥈 mp4
  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  if (mp4) return mp4[0];

  // 🥉 sources tipo JWPlayer
  const source = html.match(/file\s*:\s*"([^"]+)"/);
  if (source) return source[1];

  // 🟡 src m3u8 oculto
  const src = html.match(/src\s*=\s*"([^"]+\.m3u8[^"]*)"/);
  if (src) return src[1];

  // 🟠 data-file
  const dataFile = html.match(/data-file="([^"]+)"/);
  if (dataFile) return dataFile[1];

  return null;
}

// =====================
// 🔥 RESOLVER PROFUNDO PRO
// =====================
async function deepResolve(url: string, depth = 0): Promise<string | null> {

  if (depth > 4) return null;

  try {

    const html = await $fetch(url, { timeout: 7000 });

    // 🔥 buscar video real
    const video = extractVideoAdvanced(html);
    if (video) return video;

    // 🔥 buscar iframes
    const frames = extractIframes(html);

    for (const f of frames) {
      const res = await deepResolve(f, depth + 1);
      if (res) return res;
    }

    return null;

  } catch {
    return null;
  }
}

// =======================================================
// 🔥 LATINO PRO
// =======================================================

// 🥇 LATANIME
export async function getLatanimeServers(query: string, number: number) {
  try {
    const html = await $fetch(`https://latanime.org/?s=${query}`);

    const match = html.match(/href="([^"]+)"/);
    if (!match) return [];

    const page = await $fetch(match[1]);

    const frames = extractIframes(page);

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

// 🥈 TIOANIME
export async function getTioAnimeServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://tioanime.com/buscar?q=${query}`);
    const match = search.match(/href="\/anime\/([^"]+)"/);
    if (!match) return [];

    const ep = await $fetch(`https://tioanime.com/ver/${match[1]}-${number}`);

    const frames = extractIframes(ep);

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

// 🥉 ANIMEYT
export async function getAnimeYTServers(query: string, number: number) {
  try {
    const html = await $fetch(`https://animeyt.tv/?s=${query}`);
    const match = html.match(/href="([^"]+)"/);
    if (!match) return [];

    const page = await $fetch(match[1]);

    const frames = extractIframes(page);

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

// 🟡 ANIMEFENIX
export async function getAnimeFenixServers(query: string, number: number) {
  try {
    const html = await $fetch(`https://animefenix.com/search?q=${query}`);
    const match = html.match(/href="\/anime\/([^"]+)"/);
    if (!match) return [];

    const ep = await $fetch(`https://animefenix.com/ver/${match[1]}/${number}`);

    const frames = extractIframes(ep);

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

// 🟤 FALLBACK
export async function getAnimeIDServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animeid.tv/search?q=${query}`);
    const match = search.match(/href="\/anime\/([^"]+)"/);
    if (!match) return [];

    const ep = await $fetch(`https://animeid.tv/ver/${match[1]}/${number}`);

    const frames = extractIframes(ep);

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

// =======================================================
// 🔥 SUB (MEJORADO)
// =======================================================

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

export async function getJKAnimeServers(slug: string, number: number) {
  try {
    const html = await $fetch(`https://jkanime.net/${slug}/${number}/`);

    const links = html.match(/https?:\/\/[^"]+/g) || [];

    return links.map(link => ({
      name: "jkanime",
      embed: link
    }));

  } catch {
    return [];
  }
}
