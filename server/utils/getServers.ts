import { getJKAnimeServers, getJKAnimeSubtitles } from "./jkanime";
import { scrapePage } from "./sources"; // Zilla (opcional)
import { resolveSlugVariants } from "./slugResolver";
import { findJKAnimeSlug } from "./jkSearch";

const PROXY = "https://zetapi-api.samvelzeta.workers.dev/proxy?url=";

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
  // 1. Buscar el slug real de JKAnime usando toda la info disponible
  const realSlug = await findJKAnimeSlug({ slug, title, anilistId }, env);
  const targetSlug = realSlug || slug; // fallback al slug original

  const allServers: any[] = [];

  // 2. Obtener servidores de JKAnime
  let jkServers = await getJKAnimeServers(targetSlug, number);
  if (!jkServers.length) {
    // Si con el slug exacto no encuentra, intentar con variantes
    const variants = resolveSlugVariants(targetSlug);
    for (const v of variants) {
      jkServers = await getJKAnimeServers(v, number);
      if (jkServers.length) break;
    }
  }

  for (const s of jkServers) {
    const finalUrl = s.type === "hls" ? `${PROXY}${encodeURIComponent(s.url)}` : s.url;
    allServers.push({
      name: s.name,
      type: s.type === "hls" ? "hls" : "embed",
      embed: finalUrl,
    });
  }

  // 3. Opcional: Zilla (animeav1)
  try {
    const av1url = `https://animeav1.com/media/${targetSlug}/${number}`;
    const av1Servers = await scrapePage(av1url);
    if (av1Servers.length) {
      allServers.push(
        ...av1Servers.map((s: any) => ({
          name: "Z",
          type: "embed",
          embed: s.embed,
        }))
      );
    }
  } catch {}

  // Deduplicar
  const seen = new Set<string>();
  return allServers
    .filter((s) => {
      if (!s.embed) return false;
      const key = s.embed.split("?")[0];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

export async function getSubtitles(slug: string, episode: number) {
  return getJKAnimeSubtitles(slug, episode);
}
