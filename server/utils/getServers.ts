import { getJKAnimeServers, getJKAnimeSubtitles, getJKAnimeLatestEpisode } from "./jkanime";
import { getAnimeFLVServers } from "./animeflv";
import { findJKAnimeSlug } from "./jkSearch";
import { getAnimeMetadata } from "./metadata";
import { resolveSlugVariants } from "./slugResolver"; // Solo para AnimeFLV

export async function getAllServers({
  slug,
  number,
  title,
  anilistId,
  env,
}: {
  slug: string;
  number: number;
  title?: string;
  anilistId?: number;
  env?: any;
}) {
  const allServers: any[] = [];
  let latestEpisode: number | null = null;

  const searchTitle = title || slug;
  let extraTitles: string[] = [];
  try {
    const meta = await getAnimeMetadata(searchTitle);
    extraTitles = meta.titles;
  } catch {}

  // ─── 1. ANIMEFLV (aún con variantes de slug, hasta que implementemos su buscador) ───
  const variants = resolveSlugVariants(slug, extraTitles);
  for (const variant of variants) {
    const { servers, latestEpisode: le } = await getAnimeFLVServers(variant, number);
    if (servers.length) {
      allServers.push(...servers.map(s => ({
        name: s.name,
        type: "embed",
        embed: s.url,
        lang: "sub"
      })));
      if (le) latestEpisode = le;
      break;
    }
  }

  // ─── 2. JKANIME (buscador mejorado) ───
  if (allServers.length === 0) {
    const jkSlug = await findJKAnimeSlug(
      { slug, title: searchTitle, anilistId },
      env,
      extraTitles
    );
    if (jkSlug) {
      // Validar que el episodio existe (ya lo hace findJKAnimeSlug indirectamente)
      const jkServers = await getJKAnimeServers(jkSlug, number);
      if (jkServers.length) {
        allServers.push(...jkServers.map(s => ({
          name: s.name,
          type: "embed",
          embed: s.url,
          lang: "sub"
        })));

        const jkLatest = await getJKAnimeLatestEpisode(jkSlug);
        if (jkLatest) latestEpisode = jkLatest;
      }
    }
  }

  // Deduplicar
  const seen = new Set<string>();
  const unique = allServers.filter(s => {
    if (!s.embed) return false;
    const key = s.embed.split("?")[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    servers: unique.slice(0, 15),
    latestEpisode,
  };
}

export async function getSubtitles(slug: string, episode: number) {
  return getJKAnimeSubtitles(slug, episode);
}
