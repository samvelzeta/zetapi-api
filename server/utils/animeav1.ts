import { fetchHtml } from "./fetcher";

export interface AV1Embed {
  server: string;
  url: string;
}

/**
 * Extrae los embeds (SUB) desde el estado de SvelteKit de una página de AnimeAV1.
 */
export async function getAnimeAV1Embeds(slug: string, episode: number): Promise<AV1Embed[]> {
  const url = `https://animeav1.com/media/${slug}/${episode}`;
  console.log("🎬 AV1 extrayendo:", url);

  const html = await fetchHtml(url);
  if (!html) {
    console.log("❌ AV1: HTML vacío");
    return [];
  }

  // Localizar el script que contiene __sveltekit_1rnfyoq
  const scriptMatch = html.match(/__sveltekit_1rnfyoq\s*=\s*(\{[\s\S]*?\});\s*\n/);
  if (!scriptMatch) {
    console.log("❌ AV1: no se encontró __sveltekit_1rnfyoq");
    return [];
  }

  let data: any;
  try {
    data = JSON.parse(scriptMatch[1]);
  } catch (e) {
    console.log("❌ AV1: error al parsear JSON");
    return [];
  }

  // Navegar hasta el array de embeds SUB
  const allData = data?.data ?? [];
  let embeds: any[] = [];

  for (const item of allData) {
    if (item?.data?.embeds?.SUB) {
      embeds = item.data.embeds.SUB;
      break;
    }
  }

  if (!embeds.length) {
    console.log("❌ AV1: no se encontraron embeds SUB");
    return [];
  }

  console.log(`🎯 AV1: ${embeds.length} servidores encontrados`);
  return embeds.map((e: any) => ({
    server: e.server,
    url: e.url,
  }));
}
