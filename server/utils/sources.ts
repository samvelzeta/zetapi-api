import { getEpisode } from "animeflv-scraper";

// 🔥 detectar nombre real del server (MEJORADO)
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

// 🔥 filtro MUCHO más agresivo
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
    u.includes("schema") ||
    u.includes("track")
  );
}

// 🔥 SOLO aceptar cosas que parezcan video
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

// 🔹 ANIMEFLV (NO TOCADO + filtro)
export async function getAnimeFLVServers(slug: string, number: number) {
  try {
    const res = await getEpisode(slug, number);

    return (res?.servers || [])
      .map((s: any) => ({
        name: detectServer(s.url || s.embed),
        embed: s.url || s.embed
      }))
      .filter(s => !isBadEmbed(s.embed));
  } catch {
    return [];
  }
}

// 🔹 JKANIME (MEJORADO)
export async function getJKAnimeServers(slug: string, number: number) {
  try {
    const url = `https://jkanime.net/${slug}/${number}/`;
    const html = await $fetch(url);

    const matches = html.match(/https?:\/\/[^"]+/g) || [];

    return matches
      .filter((link: string) => !isBadEmbed(link))
      .filter((link: string) => isLikelyVideo(link))
      .map((link: string) => ({
        name: detectServer(link),
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

    return links
      .filter(link => !isBadEmbed(link))
      .filter(link => isLikelyVideo(link))
      .map(link => ({
        name: detectServer(link),
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

    return links
      .filter(link => !isBadEmbed(link))
      .filter(link => isLikelyVideo(link))
      .map(link => ({
        name: detectServer(link),
        embed: link
      }));
  } catch {
    return [];
  }
}
