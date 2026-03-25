import { getEpisode } from "animeflv-scraper";
import { $fetch } from "ofetch";

// =====================
// 🔥 DETECTAR SERVER
// =====================
function detectServer(url: string) {
  const u = url.toLowerCase();

  if (u.includes("streamwish")) return "streamwish";
  if (u.includes("filemoon")) return "filemoon";
  if (u.includes("streamtape")) return "streamtape";
  if (u.includes("mp4")) return "mp4upload";
  if (u.includes("jkanime")) return "jkanime";

  return "unknown";
}

// =====================
// 🔥 EXTRAER IFRAMES
// =====================
function extractIframes(html: string) {
  return [...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)].map(m => m[1]);
}

// =====================
// 🔥 DEEP RESOLVE REAL
// =====================
async function deepResolve(url: string, depth = 0): Promise<string | null> {
  if (depth > 2) return null;

  if (
    url.includes("stream") ||
    url.includes("filemoon") ||
    url.includes("mp4")
  ) {
    return url;
  }

  try {
    const html = await $fetch(url);
    const frames = extractIframes(html);

    for (const f of frames) {
      const result = await deepResolve(f, depth + 1);
      if (result) return result;
    }

    return null;
  } catch {
    return null;
  }
}

// =======================================================
// 🔥 LATINO (TOP 5)
// =======================================================

// 🥇 TIOANIME
export async function getTioAnimeServers(query: string, number: number) {
  try {
    const html = await $fetch(`https://tioanime.com/buscar?q=${query}`);
    const matches = [...html.matchAll(/href="\/anime\/([^"]+)"/g)];

    for (const m of matches.slice(0, 3)) {
      const slug = m[1];
      const ep = await $fetch(`https://tioanime.com/ver/${slug}-${number}`);

      const frames = extractIframes(ep);

      for (const f of frames) {
        const real = await deepResolve(f);
        if (real) return [{ name: detectServer(real), embed: real }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// 🥈 ANIMEID
export async function getAnimeIDServers(query: string, number: number) {
  try {
    const html = await $fetch(`https://animeid.tv/search?q=${query}`);
    const matches = [...html.matchAll(/href="\/anime\/([^"]+)"/g)];

    for (const m of matches.slice(0, 3)) {
      const slug = m[1];
      const ep = await $fetch(`https://animeid.tv/ver/${slug}/${number}`);

      const frames = extractIframes(ep);

      for (const f of frames) {
        const real = await deepResolve(f);
        if (real) return [{ name: detectServer(real), embed: real }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// 🥉 ANIMEYT
export async function getAnimeYTServers(query: string, number: number) {
  try {
    const html = await $fetch(`https://animeyt.tv/?s=${query}`);
    const links = html.match(/href="([^"]+)"/g) || [];

    for (const l of links.slice(0, 3)) {
      const url = l.replace('href="', "").replace('"', "");
      const page = await $fetch(url);

      const frames = extractIframes(page);

      for (const f of frames) {
        const real = await deepResolve(f);
        if (real) return [{ name: detectServer(real), embed: real }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// 🟡 ANIMEFENIX
export async function getAnimeFenixServers(query: string, number: number) {
  try {
    const html = await $fetch(`https://animefenix.com/search?q=${query}`);
    const matches = [...html.matchAll(/href="\/anime\/([^"]+)"/g)];

    for (const m of matches.slice(0, 3)) {
      const slug = m[1];
      const ep = await $fetch(`https://animefenix.com/ver/${slug}/${number}`);

      const frames = extractIframes(ep);

      for (const f of frames) {
        const real = await deepResolve(f);
        if (real) return [{ name: detectServer(real), embed: real }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// 🟡 ANIMEONLINENINJA
export async function getAnimeOnlineNinjaServers(query: string) {
  try {
    const html = await $fetch(`https://ww3.animeonlineninja.com/?s=${query}`);
    const links = html.match(/href="([^"]+)"/g) || [];

    return links.map(l => ({
      name: "ninja",
      embed: l
    }));
  } catch {
    return [];
  }
}

// =======================================================
// 🔥 SUB (NO TOCAR)
// =======================================================

export async function getAnimeFLVServers(slug: string, number: number) {
  try {
    const res = await getEpisode(slug, number);
    return res?.servers || [];
  } catch {
    return [];
  }
}

export async function getJKAnimeServers(slug: string, number: number) {
  try {
    const html = await $fetch(`https://jkanime.net/${slug}/${number}/`);
    const matches = html.match(/https?:\/\/[^"]+/g) || [];

    return matches.map(link => ({
      name: "jkanime",
      embed: link
    }));
  } catch {
    return [];
  }
}
//d
