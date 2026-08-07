import { getJKAnimeServers, getJKAnimeSubtitles } from "./jkanime";
import { scrapePage } from "./sources"; // Zilla (animeav1) – si quieres conservarlo
import { resolveSlugVariants } from "./slugResolver";
import { findJKAnimeSlug } from "./jkSearch";

const PROXY = "https://zetapi-api.samvelzeta.workers.dev/proxy?url=";

// ----------------------------------------------------------
// OBTENER TODOS LOS SERVIDORES (JKANIME + ZILLA OPCIONAL)
// ----------------------------------------------------------
export async function getAllServers({
  slug,
  number,
  title,
  env,
}: {
  slug: string;
  number: number;
  title?: string;
  env?: any;
}) {
  const variants = [
    ...resolveSlugVariants(slug),
    ...resolveSlugVariants(title || ""),
  ];

  const allServers: any[] = [];

  // ========== JKANIME ==========
  for (const v of variants) {
    let jkServers = await getJKAnimeServers(v, number);

    if (!jkServers.length) {
      const realSlug = await findJKAnimeSlug(v, env);
      if (realSlug) jkServers = await getJKAnimeServers(realSlug, number);
    }

    for (const s of jkServers) {
      const finalUrl =
        s.type === "hls" ? `${PROXY}${encodeURIComponent(s.url)}` : s.url;
      allServers.push({
        name: s.name,
        type: s.type === "hls" ? "hls" : "embed",
        embed: finalUrl,
      });
    }

    if (jkServers.length) break; // encontramos, dejamos de probar variantes
  }

  // ========== ZILLA (animeav1) – opcional ==========
  for (const v of variants) {
    const av1url = `https://animeav1.com/media/${v}/${number}`;
    const av1Servers = await scrapePage(av1url);
    if (av1Servers.length) {
      allServers.push(
        ...av1Servers.map((s: any) => ({
          name: "Z",
          type: "embed",
          embed: s.embed,
        }))
      );
      break;
    }
  }

  // Eliminar duplicados
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

// ----------------------------------------------------------
// SUBTÍTULOS UNIFICADOS (solo JKAnime)
// ----------------------------------------------------------
export async function getSubtitles(slug: string, episode: number) {
  return getJKAnimeSubtitles(slug, episode);
}
