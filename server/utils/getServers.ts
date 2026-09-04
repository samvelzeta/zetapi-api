import { getJKAnimeServers, getJKAnimeSubtitles } from "./jkanime";
import { findJKAnimeSlug } from "./jkSearch";
import { getAnimeAV1Embeds } from "./animeav1";
import { getAnimeX2Servers } from "./animex2";
import { getAnimeMetadata } from "./metadata";
import { getAnimeD23Servers } from "./animed23";
import { getAnimeFLVServers } from "./animeflv";

const PROXY = "/proxy-zilla?url=";

export interface ServerResult {
  name: string;
  type: "Externo";
  embed: string;
}

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
}): Promise<ServerResult[]> {
  const allServers: ServerResult[] = [];

  const searchTitle = title || slug;

  let meta: any = {
    titles: [searchTitle],
    malId: undefined,
  };

  try {
    const metadata = await getAnimeMetadata(searchTitle);

    if (metadata) {
      meta = metadata;
    }
  } catch (error) {
    console.log("⚠️ Error obteniendo metadata:", error);
  }

  const allTitles: string[] =
    Array.isArray(meta.titles) && meta.titles.length
      ? meta.titles
      : [searchTitle];

  const tried = new Set<string>();

  // ─────────────────────────────────────────────────────────────
  // 1. ANIMEX2
  // ─────────────────────────────────────────────────────────────

  for (const t of allTitles) {
    const slugs = generateSlugVariants(t);

    for (const candidate of slugs) {
      if (tried.has(`animex2:${candidate}`)) {
        continue;
      }

      tried.add(`animex2:${candidate}`);

      try {
        const servers =
          await getAnimeX2Servers(candidate, number);

        if (servers.length) {
          for (const s of servers) {
            if (!s?.url) continue;

            allServers.push({
              name: "",
              type: "Externo",
              embed: s.url,
            });
          }

          break;
        }
      } catch (error) {
        console.log(
          `⚠️ AnimeX2 error (${candidate}):`,
          error,
        );
      }
    }

    if (allServers.length) {
      break;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ANIMEAV1
  // ─────────────────────────────────────────────────────────────

  if (!allServers.length) {
    for (const t of allTitles) {
      const slugs = generateSlugVariants(t);

      for (const candidate of slugs) {
        if (tried.has(`animeav1:${candidate}`)) {
          continue;
        }

        tried.add(`animeav1:${candidate}`);

        try {
          const embeds =
            await getAnimeAV1Embeds(
              candidate,
              number,
            );

          if (embeds.length) {
            for (const embed of embeds) {
              if (!embed?.url) {
                continue;
              }

              /*
               * Mega se mantiene directo.
               *
               * Los demás conservan el comportamiento
               * anterior del proyecto.
               */
              const finalUrl =
                embed.server === "Mega"
                  ? embed.url
                  : `${PROXY}${encodeURIComponent(
                      embed.url,
                    )}`;

              allServers.push({
                name: "",
                type: "Externo",
                embed: finalUrl,
              });
            }

            break;
          }
        } catch (error) {
          console.log(
            `⚠️ AnimeAV1 error (${candidate}):`,
            error,
          );
        }
      }

      if (allServers.length) {
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. ANIMED23
  // ─────────────────────────────────────────────────────────────

  if (!allServers.length) {
    const d23Slugs = new Set<string>();

    d23Slugs.add(slug);

    for (const title of allTitles) {
      for (const candidate of generateSlugVariants(title)) {
        d23Slugs.add(candidate);
      }
    }

    for (const candidate of d23Slugs) {
      try {
        const servers =
          await getAnimeD23Servers(
            candidate,
            number,
          );

        if (servers.length) {
          for (const s of servers) {
            if (!s?.url) {
              continue;
            }

            allServers.push({
              name: "",
              type: "Externo",
              embed: s.url,
            });
          }

          break;
        }
      } catch (error) {
        console.log(
          `⚠️ AnimeD23 error (${candidate}):`,
          error,
        );
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. ANIMEFLV
  // ─────────────────────────────────────────────────────────────

  if (!allServers.length) {
    console.log(
      `🔎 AnimeFLV: buscando "${searchTitle}" episodio ${number}`,
    );

    try {
      /*
       * Primero intentamos directamente con todos
       * los títulos provenientes de metadata.
       */
      for (const candidateTitle of [
        searchTitle,
        ...allTitles,
      ]) {
        const animeFlvServers =
          await getAnimeFLVServersByTitleSafe(
            candidateTitle,
            number,
            allTitles,
            env,
          );

        if (animeFlvServers.length) {
          allServers.push(
            ...animeFlvServers,
          );

          break;
        }
      }
    } catch (error) {
      console.log(
        "⚠️ AnimeFLV error:",
        error,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. JKANIME
  // ─────────────────────────────────────────────────────────────

  if (!allServers.length) {
    try {
      const jkSlug =
        await findJKAnimeSlug(
          searchTitle,
          env,
          allTitles,
          meta.malId,
        );

      const targetSlug =
        jkSlug || slug;

      const jkServers =
        await getJKAnimeServers(
          targetSlug,
          number,
        );

      for (const s of jkServers) {
        if (!s?.url) {
          continue;
        }

        allServers.push({
          name: "",
          type: "Externo",
          embed: s.url,
        });
      }
    } catch (error) {
      console.log(
        "⚠️ JKAnime error:",
        error,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DEDUPLICAR
  // ─────────────────────────────────────────────────────────────

  const seen =
    new Set<string>();

  const unique =
    allServers.filter(
      server => {
        if (!server?.embed) {
          return false;
        }

        const normalized =
          normalizeEmbedForDedup(
            server.embed,
          );

        if (!normalized) {
          return false;
        }

        if (seen.has(normalized)) {
          return false;
        }

        seen.add(normalized);

        return true;
      },
    );

  // ─────────────────────────────────────────────────────────────
  // NOMBRAR SERVIDORES
  // ─────────────────────────────────────────────────────────────

  const finalServers =
    unique
      .slice(0, 15)
      .map(
        (server, index) => ({
          ...server,
          name:
            getFinalServerName(
              server.embed,
              index,
            ),
        }),
      );

  console.log(
    `🎬 Total servers encontrados: ${finalServers.length}`,
  );

  return finalServers;
}

// ─────────────────────────────────────────────────────────────
// AnimeFLV helper
// ─────────────────────────────────────────────────────────────

async function getAnimeFLVServersByTitleSafe(
  title: string,
  episode: number,
  allTitles: string[],
  env?: any,
): Promise<ServerResult[]> {
  try {
    /*
     * El propio animeflv.ts hace:
     *
     * título
     *   ↓
     * búsqueda AnimeFLV
     *   ↓
     * slug real
     *   ↓
     * página anime
     *   ↓
     * episodio
     *   ↓
     * data-src Base64
     */
    const servers =
      await getAnimeFLVServersByTitle(
        title,
        episode,
        allTitles,
        env,
      );

    return servers.map(
      server => ({
        name: server.name,
        type: "Externo",
        embed: server.embed,
      }),
    );
  } catch (error) {
    console.log(
      `⚠️ AnimeFLV "${title}":`,
      error,
    );

    return [];
  }
}

/*
 * Esta función se importa indirectamente
 * para mantener compatibilidad si el archivo
 * animeflv.ts expone solamente getAnimeFLVServers.
 *
 * Se resuelve aquí usando el slug encontrado.
 */
async function getAnimeFLVServersByTitle(
  title: string,
  episode: number,
  allTitles: string[],
  env?: any,
): Promise<{
  name: string;
  type: "Externo";
  embed: string;
}[]> {
  const {
    findAnimeFLVSlug,
    getAnimeFLVServers,
  } =
    await import("./animeflv");

  const resolvedSlug =
    await findAnimeFLVSlug(
      title,
      allTitles,
      env,
    );

  if (!resolvedSlug) {
    return [];
  }

  return getAnimeFLVServers(
    resolvedSlug,
    episode,
    allTitles,
    env,
  );
}

// ─────────────────────────────────────────────────────────────
// Nombres
// ─────────────────────────────────────────────────────────────

function getFinalServerName(
  embed: string,
  index: number,
): string {
  const url =
    embed.toLowerCase();

  /*
   * JKAnime
   */
  if (
    url.includes(
      "jkanime.net/jkplayer/umv",
    )
  ) {
    return "Magi";
  }

  if (
    url.includes(
      "jkanime.net/jkplayer/um",
    )
  ) {
    return "Desu";
  }

  /*
   * AnimeFLV / Zilla
   */
  if (
    url.includes(
      "player.zilla-networks.com",
    )
  ) {
    return "Zilla";
  }

  /*
   * MP4Upload
   */
  if (
    url.includes("mp4upload")
  ) {
    return "MP4Upload";
  }

  /*
   * Mytsumi
   */
  if (
    url.includes("mytsumi")
  ) {
    return "Mytsumi";
  }

  /*
   * Mega
   */
  if (
    url.includes("mega.nz")
  ) {
    return "Mega";
  }

  /*
   * Archive
   */
  if (
    url.includes("archive.org")
  ) {
    return "Archive";
  }

  /*
   * Byse
   */
  if (
    url.includes("byse")
  ) {
    return "Byse";
  }

  /*
   * Cualquier otro:
   * mantenemos el contrato antiguo.
   */
  return `Servidor ${index + 1}`;
}

// ─────────────────────────────────────────────────────────────
// Deduplicación
// ─────────────────────────────────────────────────────────────

function normalizeEmbedForDedup(
  value: string,
): string {
  try {
    const url =
      new URL(value);

    /*
     * No eliminamos query parameters
     * porque algunos players necesitan
     * sus parámetros para funcionar.
     */
    return (
      `${url.protocol}//` +
      `${url.host}` +
      `${url.pathname}` +
      `${url.search}`
    ).toLowerCase();
  } catch {
    return value
      .trim()
      .toLowerCase();
  }
}

// ─────────────────────────────────────────────────────────────
// Slug variants
// ─────────────────────────────────────────────────────────────

function generateSlugVariants(
  title: string,
): string[] {
  const base =
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .replace(
        /[^a-z0-9\s-]/g,
        "",
      )
      .replace(
        /\s+/g,
        "-",
      )
      .replace(
        /-+/g,
        "-",
      )
      .replace(
        /^-|-$/g,
        "",
      );

  if (!base) {
    return [];
  }

  const variants =
    new Set<string>();

  variants.add(base);

  /*
   * Eliminar season / temporada / part / parte / cour
   */
  const noSeason =
    base
      .replace(
        /\b(season|temporada|part|parte|cour)-?\d+\b/gi,
        "",
      )
      .replace(
        /\b\d+(st|nd|rd|th)-?(season|temporada)\b/gi,
        "",
      )
      .replace(
        /-+/g,
        "-",
      )
      .replace(
        /^-|-$/g,
        "",
      );

  if (
    noSeason &&
    noSeason !== base
  ) {
    variants.add(
      noSeason,
    );
  }

  /*
   * Variantes cortas.
   */
  const words =
    base
      .split("-")
      .filter(
        word =>
          word.length > 1,
      );

  if (
    words.length >= 3
  ) {
    variants.add(
      words
        .slice(0, 3)
        .join("-"),
    );

    variants.add(
      words
        .slice(0, 4)
        .join("-"),
    );
  }

  /*
   * season ↔ tv
   */
  if (
    base.includes("season")
  ) {
    variants.add(
      base.replace(
        /season/gi,
        "tv",
      ),
    );
  }

  if (
    base.includes("tv")
  ) {
    variants.add(
      base.replace(
        /tv/gi,
        "season",
      ),
    );
  }

  return [
    ...variants,
  ].slice(0, 8);
}

export async function getSubtitles(
  slug: string,
  episode: number,
) {
  return getJKAnimeSubtitles(
    slug,
    episode,
  );
}
