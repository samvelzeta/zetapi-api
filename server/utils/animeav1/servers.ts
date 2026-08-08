import { searchAnimeAV1 } from "./search";
import { inspectAnimePage, getEpisodeEmbeds } from "./parser";
import { matchScore } from "../titleMatcher";

export interface AV1Server {
  name: string;
  embed: string;
  type: "iframe";
}

export async function getAnimeAV1Servers(
  queryTitle: string,
  queryTitles: string[],
  queryMalId: number | null,
  episode: number
): Promise<AV1Server[]> {
  // Buscar candidatos
  const candidates = await searchAnimeAV1(queryTitle);
  if (!candidates.length) return [];

  // Obtener MAL ID y validar cada candidato
  const scored = [];
  for (const candidate of candidates) {
    const pageData = await inspectAnimePage(candidate.slug);
    if (!pageData) continue;
    const score = matchScore(
      pageData.title,
      pageData.slug,
      pageData.malId,
      queryTitles,
      queryMalId
    );
    scored.push({ ...candidate, malId: pageData.malId, score, episodes: pageData.episodes });
  }

  scored.sort((a, b) => b.score - a.score);

  // Probar los mejores 3
  for (const candidate of scored.slice(0, 3)) {
    if (candidate.score < 60) break;
    if (!candidate.episodes.some(e => e.number === episode)) continue;

    const epData = await getEpisodeEmbeds(candidate.slug, episode);
    if (!epData || !epData.servers.length) continue;

    const servers: AV1Server[] = [];
    const priority = ["HLS", "UPNShare", "MP4Upload", "Mega"];
    for (const p of priority) {
      const match = epData.servers.find(s => s.server === p);
      if (match) {
        // Para Zilla (HLS) usamos nuestro proxy anti‑bloqueo
        const embedUrl = match.server === "HLS"
          ? `/proxy-zilla?url=${encodeURIComponent(match.url)}`
          : match.url;
        servers.push({
          name: match.server === "HLS" ? "Zilla" : match.server,
          embed: embedUrl,
          type: "iframe",
        });
      }
    }
    if (servers.length) return servers;
  }

  return [];
}
