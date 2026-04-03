import { fetchHtml } from "../fetcher";

export async function getJKAnimeServers(slug: string, number: number) {

  try {

    const url = `https://jkanime.net/${slug}/${number}/`;

    const html = await fetchHtml(url);
    if (!html) return [];

    const servers: any[] = [];

    const matches = html.match(/https?:\/\/[^"' ]+/g);
    if (!matches) return [];

    for (const m of matches) {

      const clean = m.toLowerCase();

      if (
        clean.includes(".m3u8") ||
        clean.includes("stream") ||
        clean.includes("filemoon") ||
        clean.includes("mp4")
      ) {
        servers.push({ embed: m });
      }
    }

    return servers;

  } catch {
    return [];
  }
}
