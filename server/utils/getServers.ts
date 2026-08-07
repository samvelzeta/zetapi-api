import { getJKAnimeServers, getJKAnimeSubtitles, getJKAnimeLatestEpisode } from "./jkanime";
import { getAnimeFLVServers } from "./animeflv";
import { findJKAnimeSlug } from "./jkSearch";
import { getAnimeMetadata } from "./metadata";
import { resolveSlugVariants } from "./slugResolver";

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

  // Obtener metadatos adicionales (títulos alternativos)
  let extraTitles: string[] = [];
  if (title) {
    try {
      const meta = await getAnimeMetadata(title);
      extraTitles = meta.titles;
    } catch {}
  }

  // Generar todas las variantes de slugs posibles
  const variants = resolveSlugVariants(slug, extraTitles);

  // ─── 1. ANIMEFLV ───
  for (const variant of variants) {
    const { servers, latestEpisode: le } = await getAnimeFLVServers(variant, number);
    if (servers.length) {
      allServers.push(
        ...servers.map(s => ({
          name: s.name,
          type: "embed",
          embed: s.url,
          lang: "sub",
        }))
      );
      if (le) latestEpisode = le;
      break;
    }
  }

  // ─── 2. JKANIME ─── (si no se encontró nada en AnimeFLV)
  if (allServers.length === 0) {
    const jkSlug = await findJKAnimeSlug({ slug, title, anilistId }, env, extraTitles);
    const targetSlug = jkSlug || slug;

    const jkServers = await getJKAnimeServers(targetSlug, number);
    for (const s of jkServers) {
      allServers.push({
        name: s.name,
        type: "embed",
        embed: s.url,
        lang: "sub",
      });
    }

    const jkLatest = await getJKAnimeLatestEpisode(targetSlug);
    if (jkLatest) latestEpisode = jkLatest;
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
