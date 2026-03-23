import { $fetch } from "ofetch";

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
  if (u.includes("yourupload")) return "yourupload";
  if (u.includes("jkanime")) return "jkanime";

  return "unknown";
}

// =====================
// 🔥 UTIL MATCH MULTIPLE
// =====================
function extractMatches(html: string, regex: RegExp) {
  return [...html.matchAll(regex)].map(m => m[1]);
}

// =====================
// 🔥 LIMPIAR LINKS
// =====================
function cleanLinks(links: string[]) {
  return [...new Set(links)];
}

// =======================================================
// ===================== LATINO ============================
// =======================================================

// 🔥 TIOANIME
export async function getTioAnimeServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://tioanime.com/buscar?q=${query}`);
    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 5)) {
      const html = await $fetch(`https://tioanime.com/ver/${slug}-${number}`);

      const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
      if (iframe?.[1]) {
        return [{ name: detectServer(iframe[1]), embed: iframe[1] }];
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

    for (const slug of matches.slice(0, 5)) {
      const html = await $fetch(`https://animeid.tv/ver/${slug}/${number}`);

      const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
      if (iframe?.[1]) {
        return [{ name: detectServer(iframe[1]), embed: iframe[1] }];
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

    for (const slug of matches.slice(0, 5)) {
      const html = await $fetch(`https://animefenix.com/ver/${slug}/${number}`);

      const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
      if (iframe?.[1]) {
        return [{ name: detectServer(iframe[1]), embed: iframe[1] }];
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

    for (const slug of matches.slice(0, 5)) {
      const html = await $fetch(`https://monoschinos2.com/ver/${slug}`);

      const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
      if (iframe?.[1]) {
        return [{ name: detectServer(iframe[1]), embed: iframe[1] }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// 🔥 ANIMELHD
export async function getAnimeLHDServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animelhd.com/search?q=${query}`);
    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 5)) {
      const html = await $fetch(`https://animelhd.com/ver/${slug}/${number}`);

      const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
      if (iframe?.[1]) {
        return [{ name: detectServer(iframe[1]), embed: iframe[1] }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// =======================================================
// ===================== SUB ==============================
// =======================================================

// 🔥 ANIMEFLV
export async function getAnimeFLVServers(slug: string, number: number) {
  try {
    const html = await $fetch(`https://animeflv.net/ver/${slug}-${number}`);

    const matches = extractMatches(html, /https?:\/\/[^"' ]+/g);

    return cleanLinks(matches).map(link => ({
      name: detectServer(link),
      embed: link
    }));
  } catch {
    return [];
  }
}

// 🔥 JKANIME
export async function getJKAnimeServers(slug: string, number: number) {
  try {
    const html = await $fetch(`https://jkanime.net/${slug}/${number}/`);

    const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);

    if (iframe?.[1]) {
      return [{
        name: "jkanime",
        embed: iframe[1]
      }];
    }

    return [];
  } catch {
    return [];
  }
}

// 🔥 GOGOANIME
export async function getGogoServers(query: string) {
  try {
    const html = await $fetch(`https://gogoanime.pe/search.html?keyword=${query}`);

    const matches = extractMatches(html, /href="\/category\/([^"]+)"/g);

    for (const slug of matches.slice(0, 3)) {
      const epHtml = await $fetch(`https://gogoanime.pe/${slug}-episode-1`);

      const iframe = epHtml.match(/<iframe[^>]+src="([^"]+)"/);

      if (iframe?.[1]) {
        return [{
          name: detectServer(iframe[1]),
          embed: iframe[1]
        }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// 🔥 HIANIME
export async function getHiAnimeServers(query: string) {
  try {
    const html = await $fetch(`https://hianime.to/search?keyword=${query}`);

    const matches = extractMatches(html, /href="\/watch\/([^"]+)"/g);

    for (const slug of matches.slice(0, 3)) {
      const epHtml = await $fetch(`https://hianime.to/watch/${slug}`);

      const iframe = epHtml.match(/<iframe[^>]+src="([^"]+)"/);

      if (iframe?.[1]) {
        return [{
          name: detectServer(iframe[1]),
          embed: iframe[1]
        }];
      }
    }

    return [];
  } catch {
    return [];
  }
}
