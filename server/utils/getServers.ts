import { getJKAnimeServers, getJKAnimeSubtitles } from "./jkanime";
import { scrapePage } from "./sources";
import { findJKAnimeSlug } from "./jkSearch";
import { getAnimeMetadata } from "./metadata";

const PROXY = "/proxy-zilla?url=";

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

  const searchTitle = title || slug;
  const meta = await getAnimeMetadata(searchTitle);
  const allTitles = meta.titles;

  // ─── 1. ANIMEAV1 (UPNShare, MP4Upload, Mega) ───
  const tried = new Set<string>();
  for (const t of allTitles) {
    const candidateSlugs = generateSlugVariants(t);
    for (const candidateSlug of candidateSlugs) {
      if (tried.has(candidateSlug)) continue;
      tried.add(candidateSlug);

      const url = `https://animeav1.com/media/${candidateSlug}/${number}`;
      const av1Servers = await scrapePage(url);
      if (av1Servers.length) {
        for (const s of av1Servers) {
          // Mega sin proxy, los demás con proxy
          const embedUrl = s.name === "Mega"
            ? s.embed
            : `${PROXY}${encodeURIComponent(s.embed)}`;
          allServers.push({
            name: "",
            type: "Externo",
            embed: embedUrl,
          });
        }
        break; // encontrado
      }
    }
    if (allServers.length) break;
  }

  // ─── 2. JKANIME (Magi, Desu) ───
  if (allServers.length === 0) {
    const jkSlug = await findJKAnimeSlug(searchTitle, env, allTitles, meta.malId);
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

// ─── Helper para generar variantes de slug para AnimeAV1 ───
function generateSlugVariants(title: string): string[] {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  const variants = new Set<string>();
  variants.add(base);

  // Sin temporada / parte / cour
  const noSeason = base
    .replace(/\b(season|temporada|part|parte|cour)-?\d+\b/gi, "")
    .replace(/\b\d+(st|nd|rd|th)-?(season|temporada)\b/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (noSeason && noSeason !== base) variants.add(noSeason);

  // Versión corta (primeras 3‑4 palabras)
  const words = base.split("-").filter(w => w.length > 1);
  if (words.length >= 3) {
    variants.add(words.slice(0, 3).join("-"));
    variants.add(words.slice(0, 4).join("-"));
  }

  // Intercambiar season / tv
  if (base.includes("season")) variants.add(base.replace(/season/gi, "tv"));
  if (base.includes("tv")) variants.add(base.replace(/tv/gi, "season"));

  return Array.from(variants).slice(0, 8);
}
