import { $fetch } from "ofetch";
import { getEpisode } from "animeflv-scraper";

// =====================
// 🔥 DETECTAR SERVIDOR
// =====================
function detectServer(url: string) {
  const u = url.toLowerCase();

  if (u.includes("streamwish")) return "streamwish";
  if (u.includes("filemoon")) return "filemoon";
  if (u.includes("streamtape")) return "streamtape";
  if (u.includes("dood")) return "doodstream";
  if (u.includes("ok.ru")) return "okru";
  if (u.includes("mp4upload")) return "mp4upload";
  if (u.includes("yourupload")) return "yourupload";
  if (u.includes("jkanime")) return "jkanime";

  return "unknown";
}

// =====================
// 🔥 EXTRAER LINKS
// =====================
function extractMatches(html: string, regex: RegExp) {
  return [...html.matchAll(regex)].map(m => m[1]);
}

// =====================
// 🔥 EXTRAER IFRAMES
// =====================
function extractIframes(html: string) {
  return [...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)].map(m => m[1]);
}

// =====================
// 🔥 VALIDAR EMBED REAL
// =====================
function getValidEmbed(iframes: string[]) {
  return iframes.find(src =>
    src.includes("stream") ||
    src.includes("mp4") ||
    src.includes("embed") ||
    src.includes("player")
  );
}

// =======================================================
// ===================== LATINO ===========================
// =======================================================

// 🔥 TIOANIME
export async function getTioAnimeServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://tioanime.com/buscar?q=${query}`);
    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 6)) {
      const html = await $fetch(`https://tioanime.com/ver/${slug}-${number}`);

      const iframes = extractIframes(html);
      const valid = getValidEmbed(iframes);

      if (valid) {
        return [{ name: detectServer(valid), embed: valid }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// 🔥 ANIMEID
export async function getAnimeIDServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animeid.tv/search?q=${query}`);
    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 6)) {
      const html = await $fetch(`https://animeid.tv/ver/${slug}/${number}`);

      const iframes = extractIframes(html);
      const valid = getValidEmbed(iframes);

      if (valid) {
        return [{ name: detectServer(valid), embed: valid }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// 🔥 ANIMEFENIX
export async function getAnimeFenixServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animefenix.com/search?q=${query}`);
    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 6)) {
      const html = await $fetch(`https://animefenix.com/ver/${slug}/${number}`);

      const iframes = extractIframes(html);
      const valid = getValidEmbed(iframes);

      if (valid) {
        return [{ name: detectServer(valid), embed: valid }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// 🔥 MONOSCHINOS
export async function getMonosChinosServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://monoschinos2.com/buscar?q=${query}`);
    const matches = extractMatches(search, /href="\/ver\/([^"]+)"/g);

    for (const slug of matches.slice(0, 6)) {
      const html = await $fetch(`https://monoschinos2.com/ver/${slug}`);

      const iframes = extractIframes(html);
      const valid = getValidEmbed(iframes);

      if (valid) {
        return [{ name: detectServer(valid), embed: valid }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// 🔥 ANIMELHD (fallback simple)
export async function getAnimeLHDServers(query: string, number: number) {
  try {
    const html = await $fetch(`https://animelhd.com/?s=${query}`);

    const links = html.match(/https?:\/\/[^"]+/g) || [];

    return links.map(link => ({
      name: detectServer(link),
      embed: link
    }));
  } catch {
    return [];
  }
}

// =======================================================
// ===================== SUB ==============================
// =======================================================

// 🔥 ANIMEFLV (FUENTE PRINCIPAL)
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

// 🔥 JKANIME (FIX REAL)
export async function getJKAnimeServers(slug: string, number: number) {
  try {
    const html = await $fetch(`https://jkanime.net/${slug}/${number}/`);

    const iframes = extractIframes(html);
    const valid = getValidEmbed(iframes);

    if (valid) {
      return [{
        name: "jkanime",
        embed: valid
      }];
    }

    return [];
  } catch {
    return [];
  }
}

// 🔥 GOGO (fallback)
export async function getGogoServers(query: string) {
  try {
    const html = await $fetch(`https://gogoanime.pe/search.html?keyword=${query}`);

    const matches = extractMatches(html, /href="\/category\/([^"]+)"/g);

    for (const slug of matches.slice(0, 3)) {
      const epHtml = await $fetch(`https://gogoanime.pe/${slug}-episode-1`);

      const iframes = extractIframes(epHtml);
      const valid = getValidEmbed(iframes);

      if (valid) {
        return [{
          name: detectServer(valid),
          embed: valid
        }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// 🔥 HIANIME (fallback)
export async function getHiAnimeServers(query: string) {
  try {
    const html = await $fetch(`https://hianime.to/search?keyword=${query}`);

    const matches = extractMatches(html, /href="\/watch\/([^"]+)"/g);

    for (const slug of matches.slice(0, 3)) {
      const epHtml = await $fetch(`https://hianime.to/watch/${slug}`);

      const iframes = extractIframes(epHtml);
      const valid = getValidEmbed(iframes);

      if (valid) {
        return [{
          name: detectServer(valid),
          embed: valid
        }];
      }
    }

    return [];
  } catch {
    return [];
  }
}
