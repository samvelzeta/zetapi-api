import { getEpisode } from "animeflv-scraper";

// =====================
// 🔥 DETECTOR SERVERS
// =====================
function detectServer(url: string) {
  if (!url) return "unknown";

  const u = url.toLowerCase();

  if (u.includes("streamwish")) return "streamwish";
  if (u.includes("filemoon")) return "filemoon";
  if (u.includes("streamtape")) return "streamtape";
  if (u.includes("mp4upload")) return "mp4upload";
  if (u.includes("dood")) return "doodstream";
  if (u.includes("ok.ru")) return "okru";

  return "external";
}

// =====================
// 🔥 FILTROS
// =====================
function isBadEmbed(url: string) {
  if (!url) return true;

  const u = url.toLowerCase();

  return (
    u.startsWith("data:") ||
    u.includes(".jpg") ||
    u.includes(".png") ||
    u.includes(".gif") ||
    u.includes("logo") ||
    u.includes("banner") ||
    u.includes("ads") ||
    u.includes("doubleclick") ||
    u.includes(".css") ||
    u.includes(".js") ||
    u.includes("json") ||
    u.includes("track")
  );
}

function isLikelyVideo(url: string) {
  const u = url.toLowerCase();

  return (
    u.includes("embed") ||
    u.includes("stream") ||
    u.includes("player") ||
    u.includes(".m3u8") ||
    u.includes(".mp4")
  );
}

function cleanLinks(links: string[]) {
  return links
    .filter(l => !isBadEmbed(l))
    .filter(l => isLikelyVideo(l))
    .map(l => ({
      name: detectServer(l),
      embed: l
    }));
}

// =====================
// 🔥 JAPONES
// =====================

// AnimeFLV
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

// JKAnime
export async function getJKAnimeServers(slug: string, number: number) {
  try {
    const html = await $fetch(`https://jkanime.net/${slug}/${number}/`);
    const links = html.match(/https?:\/\/[^"]+/g) || [];
    return cleanLinks(links);
  } catch {
    return [];
  }
}

// Gogoanime
export async function getGogoServers(query: string) {
  try {
    const html = await $fetch(`https://gogoanime.pe/search.html?keyword=${query}`);
    const links = html.match(/https?:\/\/[^"]+/g) || [];
    return cleanLinks(links);
  } catch {
    return [];
  }
}

// Hianime
export async function getHiAnimeServers(query: string) {
  try {
    const html = await $fetch(`https://hianime.tv/search?keyword=${query}`);
    const links = html.match(/https?:\/\/[^"]+/g) || [];
    return cleanLinks(links);
  } catch {
    return [];
  }
}

// AnimeFenix
export async function getAnimeFenixServers(query: string) {
  try {
    const html = await $fetch(`https://animefenix.com/search?q=${query}`);
    const links = html.match(/https?:\/\/[^"]+/g) || [];
    return cleanLinks(links);
  } catch {
    return [];
  }
}

// =====================
// 🔥 LATINO REAL (EPISODIO)
// =====================

// 🔥 TIOANIME (CORRECTO)
export async function getTioAnimeServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://tioanime.com/buscar?q=${query}`);

    const match = search.match(/href="\/anime\/([^"]+)"/);
    if (!match) return [];

    const slug = match[1];

    const epUrl = `https://tioanime.com/ver/${slug}-${number}`;
    const html = await $fetch(epUrl);

    const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
    if (!iframe) return [];

    return [{
      name: detectServer(iframe[1]),
      embed: iframe[1]
    }];

  } catch {
    return [];
  }
}


// 🔥 ANIMEID
export async function getAnimeIDServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animeid.tv/?s=${query}`);

    const match = search.match(/href="https:\/\/animeid\.tv\/([^"]+)"/);
    if (!match) return [];

    const slug = match[1];

    const epUrl = `https://animeid.tv/${slug}/${number}`;
    const html = await $fetch(epUrl);

    const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
    if (!iframe) return [];

    return [{
      name: detectServer(iframe[1]),
      embed: iframe[1]
    }];

  } catch {
    return [];
  }
}


// 🔥 ANIMEFENIX (MEJORADO)
export async function getAnimeFenixServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animefenix.com/search?q=${query}`);

    const match = search.match(/href="\/anime\/([^"]+)"/);
    if (!match) return [];

    const slug = match[1];

    const epUrl = `https://animefenix.com/ver/${slug}/${number}`;
    const html = await $fetch(epUrl);

    const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
    if (!iframe) return [];

    return [{
      name: detectServer(iframe[1]),
      embed: iframe[1]
    }];

  } catch {
    return [];
  }
}


// 🔥 MONOSCHINOS (LIMITADO PERO FUNCIONAL)
export async function getMonosChinosServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://monoschinos2.com/search/${query}`);

    const match = search.match(/href="\/ver\/([^"]+)"/);
    if (!match) return [];

    const slug = match[1];

    const epUrl = `https://monoschinos2.com/ver/${slug}-${number}`;
    const html = await $fetch(epUrl);

    const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
    if (!iframe) return [];

    return [{
      name: detectServer(iframe[1]),
      embed: iframe[1]
    }];

  } catch {
    return [];
  }
}


// 🔥 ANIMELHD (fallback simple)
export async function getAnimeLHDServers(query: string, number: number) {
  try {
    const html = await $fetch(`https://animelhd.com/?s=${encodeURIComponent(query)}`);
    const links = html.match(/https?:\/\/[^"]+/g) || [];

    return cleanLinks(links);
  } catch {
    return [];
  }
}
