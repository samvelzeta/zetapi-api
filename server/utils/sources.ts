import { $fetch } from "ofetch";
import { getEpisode } from "animeflv-scraper";

// =====================
function detectServer(url: string) {
  const u = url.toLowerCase();

  if (u.includes("streamwish")) return "streamwish";
  if (u.includes("filemoon")) return "filemoon";
  if (u.includes("streamtape")) return "streamtape";
  if (u.includes("dood")) return "doodstream";
  if (u.includes("ok.ru")) return "okru";
  if (u.includes("mp4upload")) return "mp4upload";
  if (u.includes("jkanime")) return "jkanime";

  return "unknown";
}

// =====================
function extractMatches(html: string, regex: RegExp) {
  return [...html.matchAll(regex)].map(m => m[1]);
}

// =====================
function extractIframes(html: string) {
  return [...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)].map(m => m[1]);
}

// =====================
// 🔥 RESOLVER EMBED REAL
// =====================
async function resolveEmbed(url: string): Promise<string | null> {
  try {
    if (
      url.includes("stream") ||
      url.includes("filemoon") ||
      url.includes("mp4") ||
      url.includes("embed")
    ) return url;

    const html = await $fetch(url);
    const frames = extractIframes(html);

    return frames.find(f =>
      f.includes("stream") ||
      f.includes("filemoon") ||
      f.includes("mp4")
    ) || null;

  } catch {
    return null;
  }
}

// =======================================================
// 🔥 LATINO (ORDEN NUEVO)
// =======================================================

// 🥇 AnimeYT (NUEVO)
export async function getAnimeYTServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animeyt.tv/?s=${query}`);
    const matches = extractMatches(search, /href="([^"]+)"/g);

    for (const url of matches.slice(0, 3)) {
      const html = await $fetch(url);

      const frames = extractIframes(html);

      for (const f of frames) {
        const real = await resolveEmbed(f);
        if (real) {
          return [{ name: detectServer(real), embed: real }];
        }
      }
    }

    return [];
  } catch {
    return [];
  }
}

// 🥈 TioAnime
export async function getTioAnimeServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://tioanime.com/buscar?q=${query}`);
    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 4)) {
      const html = await $fetch(`https://tioanime.com/ver/${slug}-${number}`);

      const frames = extractIframes(html);

      for (const f of frames) {
        const real = await resolveEmbed(f);
        if (real) {
          return [{ name: detectServer(real), embed: real }];
        }
      }
    }

    return [];
  } catch {
    return [];
  }
}

// 🥉 AnimeID
export async function getAnimeIDServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animeid.tv/search?q=${query}`);
    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 4)) {
      const html = await $fetch(`https://animeid.tv/ver/${slug}/${number}`);

      const frames = extractIframes(html);

      for (const f of frames) {
        const real = await resolveEmbed(f);
        if (real) {
          return [{ name: detectServer(real), embed: real }];
        }
      }
    }

    return [];
  } catch {
    return [];
  }
}

// fallback
export async function getAnimeFenixServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animefenix.com/search?q=${query}`);
    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 3)) {
      const html = await $fetch(`https://animefenix.com/ver/${slug}/${number}`);

      const frames = extractIframes(html);

      for (const f of frames) {
        const real = await resolveEmbed(f);
        if (real) {
          return [{ name: detectServer(real), embed: real }];
        }
      }
    }

    return [];
  } catch {
    return [];
  }
}

// 🔴 desactivado (problemas)
export async function getAnimeLHDServers() {
  return [];
}

// =======================================================
// 🔥 SUB
// =======================================================

export async function getAnimeFLVServers(slug: string, number: number) {
  try {
    const res = await getEpisode(slug, number);

    return (res?.servers || []).map((s: any) => ({
      name: detectServer(s.url || s.embed),
      embed: s.url || s.embed
    }));
  } catch {
    return [];
  }
}

export async function getJKAnimeServers(slug: string, number: number) {
  try {
    const html = await $fetch(`https://jkanime.net/${slug}/${number}/`);

    const frames = extractIframes(html);

    for (const f of frames) {
      const real = await resolveEmbed(f);
      if (real) {
        return [{ name: "jkanime", embed: real }];
      }
    }

    return [];
  } catch {
    return [];
  }
}
