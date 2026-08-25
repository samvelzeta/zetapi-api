import {
  getJKAnimeServers,
} from "./jkanime";

import {
  findJKAnimeSlug,
} from "./jkSearch";

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
  getAnimeMetadata,
} from "./metadata";

interface FinalServer {
  name: string;
  type:
    | "iframe"
    | "mp4"
    | "embed";
  embed: string;
  lang: string;
}

/* ============================================================
 * NORMALIZACIÓN
 * ========================================================== */

function normalizeTitle(
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
      /&/g,
      " and ",
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

function slugify(
  value: string,
): string {
  return normalizeTitle(value)
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
      "");
}

/* ============================================================
 * VARIANTES
 * ========================================================== */

function generateSlugVariants(
  value: string,
): string[] {
  const base =
    slugify(value);

  if (
    !base
  ) {
    return [];
  }

  const variants =
    new Set<string>();

  const add = (
    candidate: string,
  ) => {
    const clean =
      candidate
        .replace(
          /-+/g,
          "-",
        )
        .replace(
          /^-|-$/g,
          "",
        );

    if (
      clean
    ) {
      variants.add(
        clean,
      );
    }
  };

  add(base);

  const season =
    base.match(
      /^(.*?)-(?:season|temporada|t)-?(\d+)$/i,
    );

  if (
    season
  ) {
    const title =
      season[1];

    const number =
      season[2];

    add(title);
    add(`${title}-${number}`);
    add(`${title}-${number}-season`);
    add(`${title}-${number}th-season`);
    add(`${title}-season-${number}`);
    add(`${title}-temporada-${number}`);
  }

  const ordinal =
    base.match(
      /^(.*?)-(\d+)(?:st|nd|rd|th)-season$/i,
    );

  if (
    ordinal
  ) {
    const title =
      ordinal[1];

    const number =
      ordinal[2];

    add(title);
    add(`${title}-${number}`);
    add(`${title}-${number}-season`);
    add(`${title}-${number}th-season`);
    add(`${title}-season-${number}`);
    add(`${title}-temporada-${number}`);
  }

  add(
    base.replace(
      /-(?:19|20)\d{2}$/,
      "",
    ),
  );

  add(
    base.replace(
      /-(?:season|temporada|part|parte|cour)-?\d+$/i,
      "",
    ),
  );

  return [
    ...variants,
  ].slice(
    0,
    40,
  );
}

/* ============================================================
 * TÍTULOS ALTERNATIVOS
 * ========================================================== */

async function collectTitles(
  title: string,
  slug: string,
): Promise<string[]> {
  const titles =
    new Set<string>();

  if (
    title
  ) {
    titles.add(
      title,
    );
  }

  if (
    slug
  ) {
    titles.add(
      slug,
    );
  }

  try {
    const metadata =
      await getAnimeMetadata(
        title ||
          slug,
      );

    if (
      Array.isArray(
        metadata?.titles,
      )
    ) {
      for (
        const value of
          metadata.titles
      ) {
        if (
          typeof value ===
            "string" &&
          value.trim()
            .length > 1
        ) {
          titles.add(
            value.trim(),
          );
        }
      }
    }
  } catch (
    error
  ) {
    console.log(
      "⚠️ Metadata:",
      error,
    );
  }

  return [
    ...titles,
  ];
}

/* ============================================================
 * JKANIME
 * ========================================================== */

async function collectJKAnime(
  searchTitle: string,
  slug: string,
  number: number,
  anilistId?: number,
  env?: any,
  titles: string[] = [],
): Promise<FinalServer[]> {
  try {
    const jkSlug =
      await findJKAnimeSlug(
        {
          slug,
          title:
            searchTitle,
          anilistId,
        },
        env,
        titles.filter(
          value =>
            normalizeTitle(
              value,
            ) !==
            normalizeTitle(
              searchTitle,
            ),
        ),
      );

    const targetSlug =
      jkSlug ||
      slug;

    if (
      !targetSlug
    ) {
      return [];
    }

    const servers =
      await getJKAnimeServers(
        targetSlug,
        number,
      );

    if (
      !servers.length
    ) {
      return [];
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
          name:
            server.name,

          type:
            server.type,

          embed:
            server.url,

          lang:
            "sub",
        }),
      );
  } catch (
    error
  ) {
    console.log(
      "❌ JKAnime ERROR:",
      error,
    );

    return [];
  }
}

/* ============================================================
 * ANIMED23
 * ========================================================== */

async function collectAnimeD23(
  slug: string,
  number: number,
  titles: string[],
): Promise<FinalServer[]> {
  const candidates =
    new Set<string>();

  for (
    const candidate of
      generateSlugVariants(
        slug,
      )
  ) {
    candidates.add(
      candidate,
    );
  }

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
    const candidate of
      candidates
  ) {
    try {
      const servers =
        await getAnimeD23Servers(
          candidate,
          number,
        );

      if (
        !servers.length
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
            name:
              server.name ||
              "AnimeD23",

            type:
              server.type,

            embed:
              server.url,

            lang:
              "sub",
          }),
        );
    } catch (
      error
    ) {
      console.log(
        "⚠️ AnimeD23 candidato fallido:",
        candidate,
        error,
      );
    }
  }

  return [];
}

/* ============================================================
 * ANIMEAV1
 * ========================================================== */

async function collectAV1(
  searchTitle: string,
  number: number,
  titles: string[],
  env?: any,
): Promise<FinalServer[]> {
  try {
    const av1Slug =
      await findAnimeAV1Slug(
        searchTitle,
        titles,
        env,
      );

    if (
      !av1Slug
    ) {
      return [];
    }

    const embeds =
      await getAnimeAV1Embeds(
        av1Slug,
        number,
      );

    return embeds
      .filter(
        server =>
          Boolean(
            server?.url,
          ),
      )
      .map(
        server => ({
          name:
            server.server ||
            "AV1",

          type:
            "iframe" as const,

          embed:
            server.url,

          lang:
            server.language ||
            "sub",
        }),
      );
  } catch (
    error
  ) {
    console.log(
      "❌ AnimeAV1 ERROR:",
      error,
    );

    return [];
  }
}

/* ============================================================
 * ANIMEX2
 * ========================================================== */

async function collectAnimeX2(
  slug: string,
  number: number,
  titles: string[],
): Promise<FinalServer[]> {
  const candidates =
    new Set<string>();

  for (
    const candidate of
      generateSlugVariants(
        slug,
      )
  ) {
    candidates.add(
      candidate,
    );
  }

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
    const candidate of
      candidates
  ) {
    try {
      const servers =
        await getAnimeX2Servers(
          candidate,
          number,
        );

      if (
        !servers.length
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
            name:
              server.name ||
              "AnimeX2",

            type:
              "iframe" as const,

            embed:
              server.url,

            lang:
              server.language ||
              "sub",
          }),
        );
    } catch (
      error
    ) {
      console.log(
        "⚠️ AnimeX2:",
        candidate,
        error,
      );
    }
  }

  return [];
}

/* ============================================================
 * FILTROS
 * ========================================================== */

function isBlockedOrBrokenEmbed(
  embed: string,
): boolean {
  const value =
    String(
      embed || "",
    )
      .trim()
      .toLowerCase();

  if (
    !value
  ) {
    return true;
  }

  /*
   * JKAnime:
   *
   * jk?u=stream/jkmedia/...
   */
  if (
    value.includes(
      "jkanime.net/jkplayer/jk?u=stream/jkmedia/",
    )
  ) {
    return true;
  }

  /*
   * Este dominio concreto está devolviendo 404
   * en la prueba actual.
   */
  if (
    value.includes(
      "byselapuix.com/",
    )
  ) {
    return true;
  }

  return false;
}

/* ============================================================
 * DEDUPLICAR
 * ========================================================== */

function dedupeServers(
  servers: FinalServer[],
): FinalServer[] {
  const seen =
    new Set<string>();

  return servers.filter(
    server => {
      if (
        !server?.embed
      ) {
        return false;
      }

      if (
        isBlockedOrBrokenEmbed(
          server.embed,
        )
      ) {
        return false;
      }

      const key =
        String(
          server.embed,
        )
          .trim()
          .replace(
            /\/+$/,
            "",
          )
          .toLowerCase();

      if (
        !key ||
        seen.has(key)
      ) {
        return false;
      }

      seen.add(
        key,
      );

      return true;
    },
  );
}

/* ============================================================
 * PRIORIDAD FINAL
 *
 * 1 Magi
 * 2 Desu
 * 3 MP4Upload
 * 4 Mytsumi
 * 5 Mega
 * 6 Archive
 * 7 Zilla
 * resto
 * ========================================================== */

function providerPriority(
  server: FinalServer,
): number {
  const name =
    String(
      server.name || "",
    ).toLowerCase();

  const url =
    String(
      server.embed || "",
    ).toLowerCase();

  if (
    name.includes(
      "magi",
    )
  ) {
    return 0;
  }

  if (
    name.includes(
      "desu",
    )
  ) {
    return 1;
  }

  if (
    name.includes(
      "mp4upload",
    ) ||
    url.includes(
      "mp4upload.com/embed-",
    )
  ) {
    return 2;
  }

  if (
    name.includes(
      "mytsumi",
    ) ||
    url.includes(
      "mytsumi.com/",
    )
  ) {
    return 3;
  }

  if (
    name.includes(
      "mega",
    ) ||
    url.includes(
      "mega.nz/",
    )
  ) {
    return 4;
  }

  if (
    name.includes(
      "archive",
    ) ||
    url.includes(
      "archive.org/",
    )
  ) {
    return 5;
  }

  if (
    name.includes(
      "zilla",
    ) ||
    url.includes(
      "zilla-networks.com/",
    )
  ) {
    return 6;
  }

  return 20;
}

/* ============================================================
 * NOMBRE FINAL
 * ========================================================== */

function normalizeFinalName(
  server: FinalServer,
  genericNumber: number,
): FinalServer {
  const lower =
    String(
      server.name || "",
    ).toLowerCase();

  if (
    lower.includes(
      "magi",
    )
  ) {
    return {
      ...server,
      name:
        "Magi",
    };
  }

  if (
    lower.includes(
      "desu",
    )
  ) {
    return {
      ...server,
      name:
        "Desu",
    };
  }

  return {
    ...server,
    name:
      `Server ${genericNumber}`,
  };
}

/* ============================================================
 * FUNCIÓN PRINCIPAL
 * ========================================================== */

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
    title ||
    slug;

  const titles =
    await collectTitles(
      searchTitle,
      slug,
    );

  const allServers:
    FinalServer[] = [];

  /*
   * 1. JKAnime
   *
   * SOLO Magi + Desu
   */
  allServers.push(
    ...(
      await collectJKAnime(
        searchTitle,
        slug,
        number,
        anilistId,
        env,
        titles,
      )
    ),
  );

  /*
   * 2. AnimeD23
   *
   * Mytsumi
   * Mega
   * MP4Upload
   * Archive
   * Zilla
   * etc.
   */
  allServers.push(
    ...(
      await collectAnimeD23(
        slug,
        number,
        titles,
      )
    ),
  );

  /*
   * 3. AnimeAV1
   */
  allServers.push(
    ...(
      await collectAV1(
        searchTitle,
        number,
        titles,
        env,
      )
    ),
  );

  /*
   * 4. AnimeX2
   */
  allServers.push(
    ...(
      await collectAnimeX2(
        slug,
        number,
        titles,
      )
    ),
  );

  /*
   * DEDUPLICAR Y FILTRAR
   */
  const unique =
    dedupeServers(
      allServers,
    );

  /*
   * ORDENAR
   */
  unique.sort(
    (a, b) =>
      providerPriority(
        a,
      ) -
      providerPriority(
        b,
      ),
  );

  /*
   * NUMERACIÓN:
   *
   * Magi
   * Desu
   * Server 3
   * Server 4
   * Server 5
   * ...
   */
  let genericNumber =
    3;

  const finalServers =
    unique
      .slice(
        0,
        15,
      )
      .map(
        server => {
          const result =
            normalizeFinalName(
              server,
              genericNumber,
            );

          if (
            result.name.startsWith(
              "Server ",
            )
          ) {
            genericNumber++;
          }

          return result;
        },
      );

  console.log(
    "================================================",
  );

  console.log(
    "✅ SERVIDORES FINALES:",
  );

  console.log(
    finalServers.map(
      server => ({
        name:
          server.name,
        embed:
          server.embed,
      }),
    ),
  );

  console.log(
    "================================================",
  );

  /*
   * CONTRATO COMPATIBLE CON EL FRONTEND
   */
  return finalServers.map(
    server => ({
      name:
        server.name,

      type:
        "Externo",

      embed:
        server.embed,
    }),
  );
}
