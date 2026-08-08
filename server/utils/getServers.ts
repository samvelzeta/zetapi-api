import { getJKAnimeServers, getJKAnimeLatestEpisode, findJKAnimeSlug } from "./jkanime";
import { getAnimeFLVServers } from "./animeflv";
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

  const searchTitle = title || slug;
  let extraTitles: string[] = [];
  try {
    const meta = await getAnimeMetadata(searchTitle);
    extraTitles = meta.titles || [];
  } catch (e) {
    console.log("⚠️ No se pudieron obtener títulos alternativos");
  }

  // ─── 1. JKANIME (búsqueda inteligente, prioridad máxima) ───
  console.log("🔎 BUSCANDO EN JKANIME:", searchTitle);
  const jkSlug = await findJKAnimeSlug({ slug, title: searchTitle, anilistId }, env, extraTitles);
  if (!jkSlug) {
    console.log("❌ JKAnime no encontró:", searchTitle);
  } else {
    console.log("✅ JKAnime slug:", jkSlug);
    const jkServers = await getJKAnimeServers(jkSlug, number);
    console.log("🎬 JKAnime servidores:", jkServers);
    for (const server of jkServers) {
      allServers.push({ name: server.name, type: "embed", embed: server.url, lang: "sub" });
    }
    if (allServers.length) {
      const jkLatest = await getJKAnimeLatestEpisode(jkSlug);
      if (jkLatest) latestEpisode = jkLatest;
    }
  }

  // ─── 2. ANIMEFLV (solo si JKAnime no encontró nada) ───
  if (!allServers.length) {
    console.log("⚠️ JKAnime vacío → intentando AnimeFLV");
    const variants = resolveSlugVariants(slug, extraTitles);
    for (const variant of variants) {
      const { servers, latestEpisode: le } = await getAnimeFLVServers(variant, number);
      if (servers.length) {
        allServers.push(...servers.map(s => ({
          name: s.name, type: "embed", embed: s.url, lang: "sub"
        })));
        if (le) latestEpisode = le;
        break;
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

  return { servers: unique.slice(0, 15), latestEpisode };
}
