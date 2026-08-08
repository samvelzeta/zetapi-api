import { getJKAnimeServers, getJKAnimeSubtitles } from "./jkanime";
import { getAnimeAV1Embeds } from "./animeav1";      // <-- nuevo módulo
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

  // ─── 1. ANIMEAV1 (HLS/Zilla, UPNShare, Mega, MP4Upload) ───
  const tried = new Set<string>();
  for (const t of allTitles) {
    const slugs = generateSlugVariants(t);
    for (const candidate of slugs) {
      if (tried.has(candidate)) continue;
      tried.add(candidate);

      const embeds = await getAnimeAV1Embeds(candidate, number);
      if (!embeds.length) continue;

      // Prioridad: mantener el orden original, pero podemos forzar los nombres deseados
      for (const embed of embeds) {
        // Todos pasan por el proxy menos Mega
        const finalUrl = embed.server === "Mega"
          ? embed.url
          : `${PROXY}${encodeURIComponent(embed.url)}`;

        allServers.push({
          name: "",
          type: "Externo",
          embed: finalUrl,
        });
      }
      break; // encontrado, salimos del bucle
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

  const noSeason = base
    .replace(/\b(season|temporada|part|parte|cour)-?\d+\b/gi, "")
    .replace(/\b\d+(st|nd|rd|th)-?(season|temporada)\b/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (noSeason && noSeason !== base) variants.add(noSeason);

  const words = base.split("-").filter(w => w.length > 1);
  if (words.length >= 3) {
    variants.add(words.slice(0, 3).join("-"));
    variants.add(words.slice(0, 4).join("-"));
  }

  if (base.includes("season")) variants.add(base.replace(/season/gi, "tv"));
  if (base.includes("tv")) variants.add(base.replace(/tv/gi, "season"));

  return Array.from(variants).slice(0, 8);
}
