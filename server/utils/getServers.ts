import { getJKAnimeServers, getJKAnimeSubtitles } from "./jkanime";
import { getAnimeAV1Servers } from "./animeav1";
import { getSoloLatinoServers } from "./sololatino";
import { scrapePage } from "./sources"; // Zilla opcional (ya no se usará)
import { findJKAnimeSlug } from "./jkSearch";

const PROXY = "https://zetapi-api.samvelzeta.workers.dev/proxy?url=";

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
  // Buscar slug real de JKAnime
  const realSlug = await findJKAnimeSlug({ slug, title, anilistId }, env);
  const targetSlug = realSlug || slug;

  const allServers: any[] = [];

  // ─── JKANIME (Magi, Desu, etc.) ───
  const jkServers = await getJKAnimeServers(targetSlug, number);
  for (const s of jkServers) {
    allServers.push({
      name: "",
      type: "embed",
      embed: s.url,
      lang: "sub", // JKAnime siempre es sub
    });
  }

  // ─── ANIMEAV1 (Zilla, UPNShare) ───
  try {
    const av1Servers = await getAnimeAV1Servers(targetSlug, number);
    for (const s of av1Servers) {
      allServers.push({
        name: "",
        type: "embed",
        embed: s.url,
        lang: "sub",
      });
    }
  } catch {}

  // ─── SOLOLATINO (Doblado) ───
  if (lang === "dub" && season) {
    try {
      const soloServers = await getSoloLatinoServers(
        targetSlug,
        season,
        number
      );
      for (const s of soloServers) {
        allServers.push({
          name: "",
          type: "embed",
          embed: s.url,
          lang: "dub",
        });
      }
    } catch {}
  }

  // ─── ZILLA (animeav1) antiguo – lo dejamos por si acaso, pero ya no se usa ───
  // Si prefieres eliminarlo, borra el siguiente bloque.
  try {
    const av1url = `https://animeav1.com/media/${targetSlug}/${number}`;
    const legacyAV1 = await scrapePage(av1url);
    if (legacyAV1.length) {
      allServers.push(
        ...legacyAV1.map((s: any) => ({
          name: "",
          type: "embed",
          embed: s.embed,
          lang: "sub",
        }))
      );
    }
  } catch {}

  // Deduplicar y asignar nombres genéricos
  const seen = new Set<string>();
  const unique = allServers.filter((s) => {
    if (!s.embed) return false;
    const key = s.embed.split("?")[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 15).map((s, i) => ({
    ...s,
    name: `Servidor ${i + 1}${s.lang === "dub" ? " (Dub)" : ""}`,
  }));
}

export async function getSubtitles(slug: string, episode: number) {
  return getJKAnimeSubtitles(slug, episode);
}
