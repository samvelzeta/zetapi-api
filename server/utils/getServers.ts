import { getJKAnimeServers, getJKAnimeSubtitles } from "./jkanime";
import { scrapePage } from "./sources";           // extracción original de Zilla
import { findJKAnimeSlug } from "./jkSearch";      // buscador antiguo de JKAnime
import { resolveSlugVariants } from "./slugResolver";

const PROXY_ZILLA = "/proxy-zilla?url=";   // nuestro nuevo proxy

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

  // ─── 1. ANIMEAV1 (Zilla) ───
  const variants = resolveSlugVariants(slug);
  for (const variant of variants) {
    const url = `https://animeav1.com/media/${variant}/${number}`;
    const av1Servers = await scrapePage(url);
    if (av1Servers.length) {
      for (const s of av1Servers) {
        allServers.push({
          name: "",
          type: "Externo",
          embed: `${PROXY_ZILLA}${encodeURIComponent(s.embed)}`,  // pasa por el proxy
        });
      }
      break;  // encontrado, salimos del bucle
    }
  }

  // ─── 2. JKANIME (Magi, Desu) ───
  if (allServers.length === 0) {
    const realSlug = await findJKAnimeSlug({ slug, title, anilistId }, env);
    const targetSlug = realSlug || slug;

    const jkServers = await getJKAnimeServers(targetSlug, number);
    for (const s of jkServers) {
      allServers.push({
        name: "",
        type: "Externo",
        embed: s.url,  // los iframes de Magi/Desu no necesitan proxy
      });
    }
  }

  // ─── 3. DEDUPLICAR Y NOMBRAR ───
  const seen = new Set<string>();
  const unique = allServers.filter(s => {
    if (!s.embed) return false;
    const key = s.embed.split("?")[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 15).map((s, i) => ({
    ...s,
    name: `Servidor ${i + 1}`,
  }));
}

export async function getSubtitles(slug: string, episode: number) {
  return getJKAnimeSubtitles(slug, episode);
}
