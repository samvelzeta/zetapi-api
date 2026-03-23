// REEMPLAZA TODO

import { $fetch } from "ofetch";

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

function extractMatches(html: string, regex: RegExp) {
  return [...html.matchAll(regex)].map(m => m[1]);
}

// =====================
// 🔥 LATINO MULTI MATCH
// =====================

export async function getTioAnimeServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://tioanime.com/buscar?q=${query}`);
    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 6)) {
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

export async function getAnimeIDServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animeid.tv/search?q=${query}`);
    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 6)) {
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

export async function getAnimeFenixServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animefenix.com/search?q=${query}`);
    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 6)) {
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

export async function getMonosChinosServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://monoschinos2.com/buscar?q=${query}`);
    const matches = extractMatches(search, /href="\/ver\/([^"]+)"/g);

    for (const slug of matches.slice(0, 6)) {
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

export async function getAnimeLHDServers(query: string, number: number) {
  try {
    const html = await $fetch(`https://animelhd.com/?s=${query}`);
    const links = html.match(/https?:\/\/[^"]+/g) || [];

    return links.map(l => ({
      name: detectServer(l),
      embed: l
    }));
  } catch {
    return [];
  }
}

// =====================
// 🔥 SUB (MEJORADO)
// =====================

import { getEpisode } from "animeflv-scraper";

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
    const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);

    if (iframe?.[1]) {
      return [{ name: "jkanime", embed: iframe[1] }];
    }

    return [];
  } catch {
    return [];
  }
}
