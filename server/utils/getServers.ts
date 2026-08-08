import { getAnimeAV1Servers } from "./animeav1/servers";
import { getJKAnimeServers } from "./jkanime/servers";
import { getAnimeMetadata } from "./metadata";

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
  const searchTitle = title || slug;
  const meta = await getAnimeMetadata(searchTitle);
  const allServers: any[] = [];

  // ─── 1. ANIMEAV1 ───
  try {
    const av1 = await getAnimeAV1Servers(
      searchTitle,
      meta.titles,
      meta.malId,
      number
    );
    allServers.push(...av1.map(s => ({
      name: s.name,
      type: "Externo",
      embed: s.embed,
      lang: "sub",
    })));
  } catch (e) { console.log("AV1 error:", e); }

  // ─── 2. JKANIME ───
  try {
    const jk = await getJKAnimeServers(
      searchTitle,
      meta.titles,
      meta.malId,
      number
    );
    allServers.push(...jk.map(s => ({
      name: s.name,
      type: "Externo",
      embed: s.embed,
      lang: "sub",
    })));
  } catch (e) { console.log("JK error:", e); }

  // Deduplicar (manteniendo orden: primero AV1, luego JK)
  const seen = new Set<string>();
  const unique = allServers.filter(s => {
    if (!s.embed) return false;
    const key = s.embed.split("?")[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Asignar nombres genéricos: Servidor 1, Servidor 2...
  return {
    servers: unique.slice(0, 15).map((s, i) => ({
      ...s,
      name: `Servidor ${i + 1}`,
    })),
    latestEpisode: null,
  };
}
