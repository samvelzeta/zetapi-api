import { getEpisode } from "animeflv-scraper";

// 🔹 VALIDADOR DE EMBEDS (CLAVE)
function isValidVideoUrl(url: string) {
  return /streamtape|filemoon|mp4upload|dood|okru|streamwish|yourupload/i.test(url);
}

// 🔹 EXTRAER NOMBRE REAL DEL SERVER
function getServerName(url: string) {
  if (url.includes("streamtape")) return "streamtape";
  if (url.includes("filemoon")) return "filemoon";
  if (url.includes("mp4upload")) return "mp4upload";
  if (url.includes("dood")) return "dood";
  if (url.includes("okru")) return "okru";
  if (url.includes("streamwish")) return "streamwish";
  return "external";
}

// 🔹 ANIMEFLV (BIEN)
export async function getAnimeFLVServers(slug: string, number: number) {
  try {
    const res = await getEpisode(slug, number);

    return (res?.servers || [])
      .filter((s: any) => isValidVideoUrl(s.url || s.embed))
      .map((s: any) => ({
        name: getServerName(s.url || s.embed),
        embed: s.url || s.embed
      }));
  } catch {
    return [];
  }
}

// 🔹 JKANIME (FIX REAL)
export async function getJKAnimeServers(slug: string, number: number) {
  try {
    const url = `https://jkanime.net/${slug}/${number}/`;
    const html = await $fetch(url);

    const matches = html.match(/https?:\/\/[^"]+/g) || [];

    return matches
      .filter(isValidVideoUrl) // 🔥 FILTRO CLAVE
      .map((link: string) => ({
        name: getServerName(link),
        embed: link
      }));
  } catch {
    return [];
  }
}

// 🔹 ANIMELHD (FIX)
export async function getAnimeLHDServers(query: string) {
  try {
    const html = await $fetch(`https://animelhd.com/?s=${encodeURIComponent(query)}`);
    const links = html.match(/https?:\/\/[^"]+/g) || [];

    return links
      .filter(isValidVideoUrl)
      .map((link: string) => ({
        name: getServerName(link),
        embed: link
      }));
  } catch {
    return [];
  }
}

// 🔹 MONOSCHINOS (FIX)
export async function getMonosChinosServers(query: string) {
  try {
    const html = await $fetch(`https://monoschinos2.com/search/${query}`);
    const links = html.match(/https?:\/\/[^"]+/g) || [];

    return links
      .filter(isValidVideoUrl)
      .map((link: string) => ({
        name: getServerName(link),
        embed: link
      }));
  } catch {
    return [];
  }
}
