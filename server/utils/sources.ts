import { getEpisode } from "animeflv-scraper";

// ðŸ”¹ ANIMEFLV (estable)
export async function getAnimeFLVServers(slug: string, number: number) {
  try {
    const res = await getEpisode(slug, number);
    return res?.servers || [];
  } catch {
    return [];
  }
}

// ðŸ”¹ JKANIME (scraping básico)
export async function getJKAnimeServers(slug: string, number: number) {
  try {
    const url = `https://jkanime.net/${slug}/${number}/`;
    const html = await $fetch(url);

    const matches = html.match(/https?:\/\/[^"]+/g) || [];

    return matches.map((link: string) => ({
      name: "jkanime",
      embed: link
    }));
  } catch {
    return [];
  }
}

// ðŸ”¹ ANIMELHD (latino)
export async function getAnimeLHDServers(query: string) {
  try {
    const html = await $fetch(`https://animelhd.com/?s=${encodeURIComponent(query)}`);
    const links = html.match(/https?:\/\/[^"]+/g) || [];

    return links.map((link: string) => ({
      name: "animelhd",
      embed: link
    }));
  } catch {
    return [];
  }
}

// ðŸ”¹ MONOSCHINOS (inestable)
export async function getMonosChinosServers(query: string) {
  try {
    const html = await $fetch(`https://monoschinos2.com/search/${query}`);
    const links = html.match(/https?:\/\/[^"]+/g) || [];

    return links.map((link: string) => ({
      name: "monoschinos",
      embed: link
    }));
  } catch {
    return [];
  }
}
//fix
