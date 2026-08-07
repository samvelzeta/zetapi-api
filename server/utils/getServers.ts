import { getJKAnimeServers, getJKAnimeSubtitles } from "./jkanime";
import { getAnimeD23Servers } from "./animed23"; // <-- nuevo
import { scrapePage } from "./sources";            // Zilla legacy (opcional)
import { findJKAnimeSlug } from "./jkSearch";

export async function getAllServers({
  slug,
  number,
  title,
  anilistId,
  env,
  lang,
  season,
}: {
  slug: string;
  number: number;
  title?: string;
  anilistId?: number;
  env?: any;
  lang?: string;
  season?: number;
}) {
  const allServers: any[] = [];

  // ─── 1. ANIMED23 (MYT) ─── prioridad máxima
  try {
    const d23Servers = await getAnimeD23Servers(slug, number);
    for (const s of d23Servers) {
      allServers.push({
        name: s.name,
        type: s.type === "mp4" ? "mp4" : "embed",
        embed: s.url,
        lang: s.lang,
      });
    }
  } catch {}

  // ─── 2. JKANIME (Magi, Desu, etc.) ─── respaldo
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

    // AnimeAV1 (Zilla/UPNShare) – solo si JKAnime no encontró nada
    if (allServers.length === 0) {
      try {
        const av1Servers = await getAnimeAV1Servers(targetSlug, number);
        for (const s of av1Servers) {
          allServers.push({ name: s.name, type: "embed", embed: s.url, lang: "sub" });
        }
      } catch {}
    }
  }

  // ─── 3. SOLOLATINO (Dub) – solo si se pide y no hay resultados ───
  if (lang === "dub" && season && allServers.length === 0) {
    try {
      const soloServers = await getSoloLatinoServers(targetSlug, season, number);
      for (const s of soloServers) {
        allServers.push({ name: s.name, type: "embed", embed: s.url, lang: "dub" });
      }
    } catch {}
  }

  // Deduplicar y asignar nombres genéricos si es necesario
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
    // Conservar nombre personalizado para myt, genérico para el resto
    name: s.name || `Servidor ${i + 1}${s.lang === "dub" ? " (Dub)" : ""}`,
  }));
}

export async function getSubtitles(slug: string, episode: number) {
  return getJKAnimeSubtitles(slug, episode);
}
