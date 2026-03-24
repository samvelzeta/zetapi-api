import { $fetch } from "ofetch";
import { getEpisode } from "animeflv-scraper";

// ======================
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
// 🔥 RESOLVER EMBED REAL (CLAVE)
// =====================
async function resolveRealEmbed(url: string): Promise<string | null> {
  try {
    if (
      url.includes("stream") ||
      url.includes("filemoon") ||
      url.includes("mp4") ||
      url.includes("embed")
    ) {
      return url;
    }

    const html = await $fetch(url);
    const iframes = extractIframes(html);

    const valid = iframes.find(src =>
      src.includes("stream") ||
      src.includes("filemoon") ||
      src.includes("mp4") ||
      src.includes("embed")
    );

    return valid || null;
  } catch {
    return null;
  }
}

// =======================================================
// 🔥 LATINO (ORDEN OPTIMIZADO)
// =======================================================

export async function getTioAnimeServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://tioanime.com/buscar?q=${query}`);
    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 4)) {
      const html = await $fetch(`https://tioanime.com/ver/${slug}-${number}`);

      const iframes = extractIframes(html);

      for (const frame of iframes) {
        const real = await resolveRealEmbed(frame);
        if (real) return [{ name: detectServer(real), embed: real }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

export async function getAnimeIDServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animeid.tv/search?q=${query}`);
    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 4)) {
      const html = await $fetch(`https://animeid.tv/ver/${slug}/${number}`);

      const iframes = extractIframes(html);

      for (const frame of iframes) {
        const real = await resolveRealEmbed(frame);
        if (real) return [{ name: detectServer(real), embed: real }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

export async function getAnimeFenixServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animefenix.com/search?q=${query}`);
    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 4)) {
      const html = await $fetch(`https://animefenix.com/ver/${slug}/${number}`);

      const iframes = extractIframes(html);

      for (const frame of iframes) {
        const real = await resolveRealEmbed(frame);
        if (real) return [{ name: detectServer(real), embed: real }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

export async function getMonosChinosServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://monoschinos2.com/buscar?q=${query}`);
    const matches = extractMatches(search, /href="\/ver\/([^"]+)"/g);

    for (const slug of matches.slice(0, 4)) {
      const html = await $fetch(`https://monoschinos2.com/ver/${slug}`);

      const iframes = extractIframes(html);

      for (const frame of iframes) {
        const real = await resolveRealEmbed(frame);
        if (real) return [{ name: detectServer(real), embed: real }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// 🔥 ANIMELHD → SOLO fallback final (PROBLEMA CONTROLADO)
export async function getAnimeLHDServers(query: string, number: number) {
  return [];
}

// =======================================================
// 🔥 SUB (RÁPIDO)
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

    const iframes = extractIframes(html);

    for (const frame of iframes) {
      const real = await resolveRealEmbed(frame);
      if (real) {
        return [{ name: "jkanime", embed: real }];
      }
    }

    return [];
  } catch {
    return [];
  }
}
