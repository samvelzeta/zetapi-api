import { getJKAnimeServers, getJKAnimeSubtitles } from "./jkanime";
import { scrapePage } from "./sources";
import { findJKAnimeSlug } from "./jkSearch";
import { getAnimeMetadata } from "./metadata";

const PROXY_ZILLA = "/proxy-zilla?url=";

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

  // Obtener todos los títulos desde AniList
  const searchTitle = title || slug;
  const meta = await getAnimeMetadata(searchTitle);

  // ─── 1. ANIMEAV1 (Zilla) ───
  // Probar cada título como slug (reemplazamos espacios por guiones)
  const tried = new Set<string>();
  for (const variantTitle of meta.titles) {
    const candidateSlug = variantTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    if (tried.has(candidateSlug)) continue;
    tried.add(candidateSlug);

    const url = `https://animeav1.com/media/${candidateSlug}/${number}`;
    const av1Servers = await scrapePage(url);
    if (av1Servers.length) {
      for (const s of av1Servers) {
        allServers.push({
          name: "",
          type: "Externo",
          embed: `${PROXY_ZILLA}${encodeURIComponent(s.embed)}`,
        });
      }
      break; // encontrado, salimos del bucle
    }
  }

  // ─── 2. JKANIME (Magi, Desu) ───
  if (allServers.length === 0) {
    // Probar cada título de la metadata hasta encontrar un slug válido
    let jkSlug: string | null = null;
    for (const variantTitle of meta.titles) {
      jkSlug = await findJKAnimeSlug(variantTitle, env);
      if (jkSlug) break;
    }
    // Fallback: si no encontró, intentamos con el slug original
    if (!jkSlug) {
      jkSlug = await findJKAnimeSlug(searchTitle, env);
    }
    const targetSlug = jkSlug || slug;

    const jkServers = await getJKAnimeServers(targetSlug, number);
    for (const s of jkServers) {
      allServers.push({
        name: "",
        type: "Externo",
        embed: s.url,
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
