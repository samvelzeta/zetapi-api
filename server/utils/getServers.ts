import {
  getJKAnimeServers,
  getJKAnimeSubtitles,
} from "./jkanime";

import {
  findAnimeAV1Slug,
  getAnimeAV1Embeds,
} from "./animeav1";

import {
  getAnimeD23Servers,
} from "./animed23";

import {
  getAnimeX2Servers,
} from "./animex2";

import {
  findJKAnimeSlug,
} from "./jkSearch";

import {
  getAnimeMetadata,
} from "./metadata";


// ============================================================
// TIPOS INTERNOS
// ============================================================

interface OutputServer {
  name: string;
  type: "embed";
  embed: string;
  lang: string;
}


// ============================================================
// NORMALIZACIÓN
// ============================================================

function normalizeText(
  value: string,
): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^a-z0-9\s-]/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}


// ============================================================
// VARIANTES DE SLUG
// ============================================================

function generateSlugVariants(
  value: string,
): string[] {
  const normalized =
    normalizeText(value);

  if (!normalized) {
    return [];
  }

  const joined =
    normalized
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

  const variants =
    new Set<string>();

  variants.add(joined);

  // ----------------------------------------------------------
  // Temporadas
  // ----------------------------------------------------------

  const withoutSeason =
    joined
      .replace(
        /-(?:season|temporada|part|parte|cour)-?\d+$/i,
        "",
      )
      .replace(
        /-\d+(?:st|nd|rd|th)-?(?:season|temporada)$/i,
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
    withoutSeason &&
    withoutSeason !== joined
  ) {
    variants.add(
      withoutSeason,
    );
  }

  // ----------------------------------------------------------
  // Formatos comunes de temporada
  // ----------------------------------------------------------

  const seasonMatch =
    joined.match(
      /^(.*?)-(?:season|temporada)-?(\d+)$/i,
    );

  if (seasonMatch) {
    const base =
      seasonMatch[1];

    const number =
      seasonMatch[2];

    variants.add(
      `${base}-${number}`,
    );

    variants.add(
      `${base}-tv-${number}`,
    );

    variants.add(
      `${base}-season-${number}`,
    );

    variants.add(
      `${base}-temporada-${number}`,
    );
  }

  // ----------------------------------------------------------
  // Primeras palabras
  // ----------------------------------------------------------

  const words =
    joined
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
  }

  if (
    words.length >= 4
  ) {
    variants.add(
      words
        .slice(0, 4)
        .join("-"),
    );
  }

  return [
    ...variants,
  ].filter(
    value =>
      value.length > 2,
  );
}


// ============================================================
// TÍTULOS PARA BÚSQUEDA
// ============================================================

async function getSearchTitles(
  title: string,
  slug: string,
): Promise<string[]> {
  const result =
    new Set<string>();

  if (title) {
    result.add(title);
  }

  if (slug) {
    result.add(slug);
  }

  try {
    const metadata =
      await getAnimeMetadata(
        title || slug,
      );

    if (
      metadata?.titles &&
      Array.isArray(
        metadata.titles,
      )
    ) {
      for (
        const value of metadata.titles
      ) {
        if (
          typeof value ===
            "string" &&
          value.trim()
            .length > 1
        ) {
          result.add(
            value.trim(),
          );
        }
      }
    }
  } catch (error) {
    console.log(
      "⚠️ Metadata:",
      error,
    );
  }

  return [
    ...result,
  ];
}


// ============================================================
// JKANIME
// ============================================================

async function collectJKAnime(
  searchTitle: string,
  slug: string,
  episode: number,
  anilistId?: number,
  env?: any,
  extraTitles: string[] = [],
): Promise<OutputServer[]> {
  try {
    const jkSlug =
      await findJKAnimeSlug(
        {
          slug,
          title: searchTitle,
          anilistId,
        },
        env,
        extraTitles,
      );

    if (!jkSlug) {
      console.log(
        "⚠️ JKAnime: slug no encontrado",
      );

      return [];
    }

    console.log(
      "🔎 JKAnime slug:",
      jkSlug,
    );

    const servers =
      await getJKAnimeServers(
        jkSlug,
        episode,
      );

    if (
      !servers?.length
    ) {
      return [];
    }

    // --------------------------------------------------------
    // MAGI → DESU → RESTO
    // --------------------------------------------------------

    const priority = (
      name: string,
    ): number => {
      const value =
        String(name || "")
          .toLowerCase();

      if (
        value.includes("magi")
      ) {
        return 0;
      }

      if (
        value.includes("desu")
      ) {
        return 1;
      }

      if (
        value.includes("yourupload")
      ) {
        return 2;
      }

      if (
        value.includes("mega")
      ) {
        return 3;
      }

      return 10;
    };

    servers.sort(
      (a, b) =>
        priority(a.name) -
        priority(b.name),
    );

    return servers
      .filter(
        server =>
          Boolean(
            server?.url,
          ),
      )
      .map(
        server => ({
          name:
            /magi/i.test(
              server.name || "",
            )
              ? "Magi"
              : /desu/i.test(
                  server.name || "",
                )
              ? "Desu"
              : "Server",

          type: "embed" as const,

          embed:
            server.url,

          lang: "sub",
        }),
      );
  } catch (error) {
    console.log(
      "❌ JKAnime:",
      error,
    );

    return [];
  }
}


// ============================================================
// ANIME AV1
// ============================================================

async function collectAV1(
  searchTitle: string,
  slug: string,
  episode: number,
  extraTitles: string[] = [],
  env?: any,
): Promise<OutputServer[]> {
  try {
    const av1Slug =
      await findAnimeAV1Slug(
        searchTitle,
        [
          slug,
          ...extraTitles,
        ],
        env,
      );

    if (!av1Slug) {
      console.log(
        "⚠️ AV1: slug no encontrado",
      );

      return [];
    }

    console.log(
      "🔎 AV1 slug:",
      av1Slug,
    );

    const embeds =
      await getAnimeAV1Embeds(
        av1Slug,
        episode,
      );

    if (
      !embeds?.length
    ) {
      return [];
    }

    return embeds
      .filter(
        embed =>
          Boolean(
            embed?.url,
          ),
      )
      .map(
        embed => ({
          name:
            /mega/i.test(
              embed.server || "",
            )
              ? "Server"
              : "Server",

          type:
            "embed" as const,

          embed:
            embed.url,

          lang:
            embed.language ||
            "sub",
        }),
      );
  } catch (error) {
    console.log(
      "❌ AV1:",
      error,
    );

    return [];
  }
}


// ============================================================
// ANIMED23
// ============================================================

async function collectAnimeD23(
  titles: string[],
  slug: string,
  episode: number,
): Promise<OutputServer[]> {
  const candidates =
    new Set<string>();

  candidates.add(slug);

  for (
    const title of titles
  ) {
    for (
      const candidate of
        generateSlugVariants(
          title,
        )
    ) {
      candidates.add(
        candidate,
      );
    }
  }

  for (
    const candidate of candidates
  ) {
    try {
      console.log(
        "🔎 AnimeD23:",
        candidate,
      );

      const servers =
        await getAnimeD23Servers(
          candidate,
          episode,
        );

      if (
        !servers?.length
      ) {
        continue;
      }

      return servers
        .filter(
          server =>
            Boolean(
              server?.url,
            ),
        )
        .map(
          server => ({
            name: "Server",
            type:
              "embed" as const,
            embed:
              server.url,
            lang: "sub",
          }),
        );
    } catch (error) {
      console.log(
        "⚠️ AnimeD23 candidate:",
        candidate,
        error,
      );
    }
  }

  return [];
}


// ============================================================
// ANIMEX2
// ============================================================

async function collectAnimeX2(
  titles: string[],
  slug: string,
  episode: number,
): Promise<OutputServer[]> {
  const candidates =
    new Set<string>();

  candidates.add(slug);

  for (
    const title of titles
  ) {
    for (
      const candidate of
        generateSlugVariants(
          title,
        )
    ) {
      candidates.add(
        candidate,
      );
    }
  }

  for (
    const candidate of candidates
  ) {
    try {
      console.log(
        "🔎 AnimeX2:",
        candidate,
      );

      const servers =
        await getAnimeX2Servers(
          candidate,
          episode,
        );

      if (
        !servers?.length
      ) {
        continue;
      }

      return servers
        .filter(
          server =>
            Boolean(
              server?.url,
            ),
        )
        .map(
          server => ({
            name: "Server",
            type:
              "embed" as const,
            embed:
              server.url,
            lang:
              server.language ||
              "sub",
          }),
        );
    } catch (error) {
      console.log(
        "⚠️ AnimeX2 candidate:",
        candidate,
        error,
      );
    }
  }

  return [];
}


// ============================================================
// DEDUPLICACIÓN
// ============================================================

function dedupeServers(
  servers: OutputServer[],
): OutputServer[] {
  const seen =
    new Set<string>();

  return servers.filter(
    server => {
      if (
        !server?.embed
      ) {
        return false;
      }

      const normalized =
        String(
          server.embed,
        )
          .trim()
          .replace(
            /\/+$/,
            "",
          )
          .toLowerCase();

      if (!normalized) {
        return false;
      }

      if (
        seen.has(
          normalized,
        )
      ) {
        return false;
      }

      seen.add(
        normalized,
      );

      return true;
    },
  );
}


// ============================================================
// API PRINCIPAL
// ============================================================

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
  const searchTitle =
    title || slug;

  console.log(
    "🎬 getAllServers:",
    {
      slug,
      number,
      title:
        searchTitle,
    },
  );

  const titles =
    await getSearchTitles(
      searchTitle,
      slug,
    );

  const extraTitles =
    titles.filter(
      value =>
        normalizeText(
          value,
        ) !==
        normalizeText(
          searchTitle,
        ),
    );

  const allServers:
    OutputServer[] = [];

  // ==========================================================
  // 1. JKANIME — PRIORIDAD ABSOLUTA
  // ==========================================================

  const jkServers =
    await collectJKAnime(
      searchTitle,
      slug,
      number,
      anilistId,
      env,
      extraTitles,
    );

  allServers.push(
    ...jkServers,
  );

  // ==========================================================
  // 2. AV1 — SIEMPRE SE CONSULTA
  //
  // IMPORTANTE:
  // no depende de que JKAnime haya encontrado servidores.
  // ==========================================================

  const av1Servers =
    await collectAV1(
      searchTitle,
      slug,
      number,
      extraTitles,
      env,
    );

  allServers.push(
    ...av1Servers,
  );

  // ==========================================================
  // 3. ANIMED23
  // ==========================================================

  const d23Servers =
    await collectAnimeD23(
      titles,
      slug,
      number,
    );

  allServers.push(
    ...d23Servers,
  );

  // ==========================================================
  // 4. ANIMEX2
  // ==========================================================

  const x2Servers =
    await collectAnimeX2(
      titles,
      slug,
      number,
    );

  allServers.push(
    ...x2Servers,
  );

  // ==========================================================
  // DEDUPLICAR
  // ==========================================================

  const unique =
    dedupeServers(
      allServers,
    );

  // ==========================================================
  // NOMBRAR
  //
  // MAGI y DESU conservan su nombre.
  // TODO LO DEMÁS:
  //
  // Server 3
  // Server 4
  // Server 5
  // ==========================================================

  let genericNumber =
    3;

  const finalServers =
    unique.map(
      server => {
        const current =
          String(
            server.name ||
              "",
          ).toLowerCase();

        if (
          current.includes(
            "magi",
          )
        ) {
          return {
            ...server,
            name: "Magi",
          };
        }

        if (
          current.includes(
            "desu",
          )
        ) {
          return {
            ...server,
            name: "Desu",
          };
        }

        return {
          ...server,
          name:
            `Server ${genericNumber++}`,
        };
      },
    );

  console.log(
    "✅ Servers finales:",
    finalServers.length,
  );

  return {
    servers:
      finalServers.slice(
        0,
        15,
      ),

    // Mantenemos la propiedad
    // para no romper el contrato
    // existente con tu frontend.
    latestEpisode: null,

    success:
      finalServers.length > 0,
  };
}


// ============================================================
// SUBTÍTULOS
// ============================================================

export async function getSubtitles(
  slug: string,
  episode: number,
) {
  return getJKAnimeSubtitles(
    slug,
    episode,
  );
}
