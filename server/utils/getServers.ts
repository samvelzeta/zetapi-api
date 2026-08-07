import { getJKAnimeServers, getJKAnimeSubtitles } from "./jkanime";
import { getAnimeFLVServers } from "./animeflv";
import { findJKAnimeSlug } from "./jkSearch";

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

  // ─── 1. ANIMEFLV (TurboVid, UPNShare, Mega, MP4Upload) ─── PRIORIDAD MÁXIMA
  try {
    const flvServers = await getAnimeFLVServers(slug, number);
    for (const s of flvServers) {
      allServers.push({
        name: s.name,
        type: "embed",
        embed: s.url,
        lang: "sub",
      });
    }
  } catch {}

  // ─── 2. JKANIME (Magi, Desu) ─── RESPALDO
  if (allServers.length === 0) {
    const realSlug = await findJKAnimeSlug({ slug, title, anilistId }, env);
    const targetSlug = realSlug || slug;

    const jkServers = await getJKAnimeServers(targetSlug, number);
    for (const s of jkServers) {
      allServers.push({
        name: s.name,
        type: "embed",
        embed: s.url,
        lang: "sub",
      });
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

  return unique.slice(0, 15);
}

export async function getSubtitles(slug: string, episode: number) {
  return getJKAnimeSubtitles(slug, episode);
}
