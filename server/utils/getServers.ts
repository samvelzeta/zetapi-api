import { getJKAnimeServers, getJKAnimeSubtitles } from "./jkanime";
import { scrapePage } from "./sources"; // Zilla (opcional)
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
  const realSlug = await findJKAnimeSlug({ slug, title, anilistId }, env);
  const targetSlug = realSlug || slug;

  const allServers: any[] = [];

  // 1. Servidores JKAnime (Magi, Desu, YourUpload, Mega)
  const jkServers = await getJKAnimeServers(targetSlug, number);
  for (const s of jkServers) {
    allServers.push({
      // nombre vacío, se rellena después
      name: "",
      type: "Externo",       // siempre "Externo"
      embed: s.url,
    });
  }

  // 2. Zilla (opcional)
  try {
    const av1url = `https://animeav1.com/media/${targetSlug}/${number}`;
    const av1Servers = await scrapePage(av1url);
    if (av1Servers.length) {
      for (const s of av1Servers) {
        allServers.push({
          name: "",
          type: "Externo",
          embed: s.embed,
        });
      }
    }
  } catch {}

  // Eliminar duplicados (mantiene el orden de inserción)
  const seen = new Set<string>();
  const unique = allServers.filter((s) => {
    if (!s.embed) return false;
    const key = s.embed.split("?")[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Asignar nombres genéricos: Servidor 1, Servidor 2, ...
  return unique.slice(0, 10).map((s, i) => ({
    ...s,
    name: `Servidor ${i + 1}`,
  }));
}

export async function getSubtitles(slug: string, episode: number) {
  return getJKAnimeSubtitles(slug, episode);
}
