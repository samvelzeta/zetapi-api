import { getEpisode } from "animeflv-scraper";

// 🔹 FILTRO SUAVE (NO ROMPE)
function cleanLinks(links: string[]) {
  return links.filter(link => {
    // ❌ eliminar basura clara
    if (link.includes(".css")) return false;
    if (link.includes(".js")) return false;
    if (link.includes(".svg")) return false;
    if (link.includes(".png")) return false;
    if (link.includes(".jpg")) return false;
    if (link.includes("schema.org")) return false;
    if (link.includes("w3.org")) return false;
    if (link.includes(".dtd")) return false; // 🔥 este era tu bug

    return link.startsWith("http");
  });
}

// 🔹 DETECTAR NOMBRE SIN ROMPER
function detectServerName(url: string) {
  if (url.includes("streamtape")) return "streamtape";
  if (url.includes("filemoon")) return "filemoon";
  if (url.includes("mp4upload")) return "mp4upload";
  if (url.includes("dood")) return "dood";
  if (url.includes("okru")) return "okru";
  if (url.includes("yourupload")) return "yourupload";
  return "external"; // fallback
}

// 🔹 ANIMEFLV
export async function getAnimeFLVServers(slug: string, number: number) {
  try {
    const res = await getEpisode(slug, number);

    return (res?.servers || []).map((s: any) => ({
      name: detectServerName(s.url || s.embed),
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

    const clean = cleanLinks(matches);

    return clean.map((link: string) => ({
      name: detectServerName(link),
      embed: link
    }));
  } catch {
    return [];
  }
}

// 🔹 ANIMELHD
export async function getAnimeLHDServers(query: string) {
  try {
    const html = await $fetch(`https://animelhd.com/?s=${encodeURIComponent(query)}`);
    const links = html.match(/https?:\/\/[^"]+/g) || [];

    const clean = cleanLinks(links);

    return clean.map((link: string) => ({
      name: detectServerName(link),
      embed: link
    }));
  } catch {
    return [];
  }
}

// 🔹 MONOSCHINOS
export async function getMonosChinosServers(query: string) {
  try {
    const html = await $fetch(`https://monoschinos2.com/search/${query}`);
    const links = html.match(/https?:\/\/[^"]+/g) || [];

    const clean = cleanLinks(links);

    return clean.map((link: string) => ({
      name: detectServerName(link),
      embed: link
    }));
  } catch {
    return [];
  }
}
