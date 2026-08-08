import { searchJKAnime } from "./search";
import { inspectJKAnimePage, getEpisodeServers, JKServer } from "./parser";
import { matchScore } from "../titleMatcher";

export async function getJKAnimeServers(
  queryTitle: string,
  queryTitles: string[],
  queryMalId: number | null,
  episode: number
): Promise<JKServer[]> {
  const candidates = await searchJKAnime(queryTitle);
  if (!candidates.length) return [];

  const scored = [];
  for (const c of candidates) {
    const pageData = await inspectJKAnimePage(c.slug);
    if (!pageData) continue;
    const score = matchScore(pageData.title, pageData.slug, null, queryTitles, queryMalId);
    scored.push({ ...c, score, episodesCount: pageData.episodesCount });
  }

  scored.sort((a, b) => b.score - a.score);

  for (const candidate of scored.slice(0, 3)) {
    if (candidate.score < 60) break;
    if (candidate.episodesCount !== null && candidate.episodesCount < episode) continue;
    const servers = await getEpisodeServers(candidate.slug, episode);
    if (servers.length) return servers;
  }
  return [];
}
