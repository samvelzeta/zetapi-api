import { fetchHtml } from "./fetcher";

export interface AV1Server {
  name: string;
  url: string;
  type: "iframe";
}

// ----------------------------------------------------------
// EXTRAER SERVIDORES DE ANIMEAV1 (ZILLA, UPNShare, etc.)
// ----------------------------------------------------------
export async function getAnimeAV1Servers(
  slug: string,
  episode: number
): Promise<AV1Server[]> {
  const url = `https://animeav1.com/media/${slug}/${episode}`;
  const html = await fetchHtml(url);
  if (!html) return [];

  // Buscar el bloque de datos de SvelteKit
  const scriptMatch = html.match(
    /__sveltekit_1rnfyoq\s*=\s*\{[^}]*data:\s*(\[[^\]]+\])/s
  );
  if (!scriptMatch) return [];

  try {
    const dataArray = JSON.parse(scriptMatch[1]);
    const episodeData = dataArray.find(
      (d: any) => d?.type === "data" && d?.data?.embeds
    );
    if (!episodeData) return [];

    const embeds = episodeData.data.embeds;
    const servers: AV1Server[] = [];
    const seen = new Set<string>();

    // Procesar todos los idiomas disponibles (normalmente SUB)
    for (const lang of Object.keys(embeds)) {
      const langEmbeds = embeds[lang];
      if (!Array.isArray(langEmbeds)) continue;

      for (const item of langEmbeds) {
        // Solo nos interesan Zilla (HLS) y UPNShare
        if (item.server === "HLS" || item.server === "UPNShare") {
          if (!seen.has(item.url)) {
            seen.add(item.url);
            servers.push({
              name: item.server === "HLS" ? "Zilla" : "UPNShare",
              url: item.url,
              type: "iframe",
            });
          }
        }
      }
    }

    return servers;
  } catch {
    return [];
  }
}
