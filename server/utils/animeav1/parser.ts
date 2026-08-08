import { fetchHtml } from "../fetcher";

export interface AV1AnimeData {
  malId: number | null;
  title: string;
  slug: string;
  episodes: { number: number; id: number }[];
}

export interface AV1EpisodeData {
  servers: { server: string; url: string }[];
}

function extractEmbeddedData(html: string): any | null {
  const scriptMatch = html.match(
    /__sveltekit_1rnfyoq\s*=\s*(\{[\s\S]*?\});/i
  );
  if (!scriptMatch) return null;
  try {
    return JSON.parse(scriptMatch[1]);
  } catch { return null; }
}

export async function inspectAnimePage(slug: string): Promise<AV1AnimeData | null> {
  const url = `https://animeav1.com/media/${slug}`;
  const html = await fetchHtml(url);
  if (!html) return null;

  const data = extractEmbeddedData(html);
  if (!data) return null;

  const media = data.data?.[2]?.data?.media;
  if (!media) return null;

  return {
    malId: media.malId ?? null,
    title: media.title,
    slug: media.slug,
    episodes: (media.episodes || []).map((e: any) => ({ number: e.number, id: e.id })),
  };
}

export async function getEpisodeEmbeds(slug: string, episodeNum: number): Promise<AV1EpisodeData | null> {
  const animeData = await inspectAnimePage(slug);
  if (!animeData) return null;

  const episode = animeData.episodes.find(e => e.number === episodeNum);
  if (!episode) return null;

  // Cargar la página del episodio para obtener los embeds
  const epUrl = `https://animeav1.com/media/${slug}/${episodeNum}`;
  const html = await fetchHtml(epUrl);
  if (!html) return null;

  const data = extractEmbeddedData(html);
  if (!data) return null;

  const embeds = data.data?.[2]?.data?.embeds?.SUB || [];
  const servers = embeds.map((e: any) => ({ server: e.server, url: e.url }));

  return { servers };
}
