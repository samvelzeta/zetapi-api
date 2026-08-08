import { fetchHtml } from "../fetcher";

export interface JKAnimeData {
  title: string;
  slug: string;
  episodesCount: number | null;
}

export async function inspectJKAnimePage(slug: string): Promise<JKAnimeData | null> {
  const html = await fetchHtml(`https://jkanime.net/${slug}/`);
  if (!html) return null;

  const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const title = titleMatch ? titleMatch[1] : "";

  // Contar episodios (paginationEps)
  const pagMatch = html.match(/paginationEps\((\d+)\)/);
  const episodesCount = pagMatch ? parseInt(pagMatch[1]) : null;

  return { title, slug, episodesCount };
}

export interface JKServer {
  name: string;
  embed: string;
  type: "iframe";
}

export async function getEpisodeServers(slug: string, episode: number): Promise<JKServer[]> {
  const url = `https://jkanime.net/${slug}/${episode}/`;
  const html = await fetchHtml(url);
  if (!html) return [];

  const videos = new Map<number, string>();
  const regex = /video\s*\[\s*(\d+)\s*\]\s*=\s*(['"])([\s\S]*?)\2\s*;/gi;
  let match;
  while ((match = regex.exec(html))) {
    const index = parseInt(match[1]);
    const srcMatch = match[3].match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    let src = srcMatch[1];
    if (src.startsWith("//")) src = "https:" + src;
    if (src.startsWith("/")) src = "https://jkanime.net" + src;
    videos.set(index, src);
  }

  // Mapear data-id a nombres Desu/Magi
  const buttonRegex = /<a\b[^>]*data-id=["'](\d+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const servers: JKServer[] = [];
  while ((match = buttonRegex.exec(html))) {
    const index = parseInt(match[1]);
    const name = match[2].replace(/<[^>]+>/g, " ").trim().toLowerCase();
    if ((name !== "desu" && name !== "magi") || !videos.has(index)) continue;
    servers.push({
      name: name === "desu" ? "Desu" : "Magi",
      embed: videos.get(index)!,
      type: "iframe",
    });
  }

  return servers;
}
