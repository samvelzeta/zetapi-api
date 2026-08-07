import { getJKAnimeServers, getJKAnimeSubtitles } from "./jkanime";
import { scrapePage } from "./sources"; // Zilla (animeav1) – opcional
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
  // 1. Buscar el slug real de JKAnime con toda la info disponible
  const realSlug = await findJKAnimeSlug({ slug, title, anilistId }, env);
  const targetSlug = realSlug || slug;

  const allServers: any[] = [];

  // 2. Obtener servidores de JKAnime (Magi, Desu, YourUpload, Mega)
  const jkServers = await getJKAnimeServers(targetSlug, number);
  for (const s of jkServers) {
    // Todos se envían como tipo 'embed' para que el frontend los maneje (iframes o enlaces directos)
    allServers.push({
      name: s.name,
      type: "embed",
      embed: s.url,
    });
  }

  // 3. Zilla (animeav1) – opcional, puedes quitarlo si no lo usas
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

  // Deduplicar y limitar
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
