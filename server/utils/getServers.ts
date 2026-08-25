import {
  getJKAnimeServers,
  getJKAnimeSubtitles,
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


// ============================================================
// TIPOS
// ============================================================

interface FinalServer {
  name: string;

  type:
    | "iframe"
    | "mp4"
    | "embed";

  embed: string;

  lang: string;
}


// ============================================================
// NORMALIZACIÓN
// ============================================================

function normalizeTitle(
  value: string,
): string {
  return String(
    value || "",
  )
    .toLowerCase()
    .normalize(
      "NFD",
    )
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


// ============================================================
// SLUG
// ============================================================

function slugify(
  value: string,
): string {
  return normalizeTitle(
    value,
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
}


// ============================================================
// VARIANTES
// ============================================================

function generateSlugVariants(
  value: string,
): string[] {
  const base =
    slugify(value);

  if (!base) {
    return [];
  }

  const variants =
    new Set<string>();

  const add =
    (
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

      if (clean) {
        variants.add(
          clean,
        );
      }
    };

  add(base);

  // ----------------------------------------------------------
  // title-season-2
  // ----------------------------------------------------------

  const season =
    base.match(
      /^(.*?)-(?:season|temporada)-?(\d+)$/i,
    );

  if (season) {
    const title =
      season[1];

    const number =
      season[2];

    add(title);

    add(
      `${title}-${number}`,
    );

    add(
      `${title}-${number}th-season`,
    );

    add(
      `${title}-${number}-season`,
    );

    add(
      `${title}-season-${number}`,
    );

    add(
      `${title}-temporada-${number}`,
    );
  }

  // ----------------------------------------------------------
  // title-2nd-season
  // ----------------------------------------------------------

  const ordinal =
    base.match(
      /^(.*?)-(\d+)(?:st|nd|rd|th)-season$/i,
    );

  if (ordinal) {
    const title =
      ordinal[1];

    const number =
      ordinal[2];

    add(title);

    add(
      `${title}-${number}`,
    );

    add(
      `${title}-${number}-season`,
    );

    add(
      `${title}-${number}th-season`,
    );

    add(
      `${title}-season-${number}`,
    );
  }

  // ----------------------------------------------------------
  // quitar año
  // ----------------------------------------------------------

  add(
    base.replace(
      /-(?:19|20)\d{2}$/,
      "",
    ),
  );

  // ----------------------------------------------------------
  // quitar temporada
  // ----------------------------------------------------------

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
    20,
  );
}


// ============================================================
// METADATA
// ============================================================

async function collectTitles(
  title: string,
  slug: string,
): Promise<string[]> {
  const titles =
    new Set<string>();

  if (title) {
    titles.add(
      title,
    );
  }

  if (slug) {
    titles.add(
      slug,
    );
  }

  try {
    const metadata =
      await getAnimeMetadata(
        title || slug,
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
  } catch (error) {
    console.log(
      "⚠️ Metadata:",
      error,
    );
  }

  return [
    ...titles,
  ];
}


// ============================================================
// JKANIME
// ============================================================

async function collectJKAnime(
  searchTitle: string,
  slug: string,
  number: number,
  anilistId?: number,
  env?: any,
  titles: string[] = [],
): Promise<FinalServer[]> {
  try {
    console.log(
      "================================================",
    );

    console.log(
      "🔵 JKANIME",
    );

    console.log(
      "================================================",
    );

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
      jkSlug || slug;

    console.log(
      "🔎 JKAnime slug:",
      targetSlug,
    );

    if (!targetSlug) {
      return [];
    }

    const servers =
      await getJKAnimeServers(
        targetSlug,
        number,
      );

    if (
      !servers?.length
    ) {
      console.log(
        "⚠️ JKAnime no devolvió servidores",
      );

      return [];
    }

    // --------------------------------------------------------
    // MAGI → DESU → RESTO
    // --------------------------------------------------------

    const priority =
      (
        server: {
          name?: string;
        },
      ): number => {
        const name =
          String(
            server.name ||
              "",
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
            "yourupload",
          )
        ) {
          return 2;
        }

        if (
          name.includes(
            "mega",
          )
        ) {
          return 3;
        }

        return 10;
      };

    servers.sort(
      (a, b) =>
        priority(a) -
        priority(b),
    );

    const result:
      FinalServer[] = [];

    for (
      const server of
        servers
    ) {
      if (
        !server?.url
      ) {
        continue;
      }

      result.push({
        name:
          server.name ||
          "JKAnime",

        type:
          server.type ===
          "mp4"
            ? "mp4"
            : "iframe",

        embed:
          server.url,

        lang:
          "sub",
      });
    }

    console.log(
      "✅ JKAnime:",
      result.map(
        server => ({
          name:
            server.name,
          type:
            server.type,
        }),
      ),
    );

    return result;
  } catch (error) {
    console.log(
      "❌ JKAnime ERROR:",
      error,
    );

    return [];
  }
}


// ============================================================
// ANIMED23
// ============================================================

async function collectAnimeD23(
  slug: string,
  number: number,
  titles: string[],
): Promise<FinalServer[]> {
  console.log(
    "================================================",
  );

  console.log(
    "🟣 ANIMED23",
  );

  console.log(
    "================================================",
  );

  const candidates =
    new Set<string>();

  // Primero el slug recibido.
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

  // Después todos los títulos.
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

  console.log(
    "🔎 AnimeD23 candidatos:",
    [
      ...candidates,
    ],
  );

  for (
    const candidate of
      candidates
  ) {
    try {
      console.log(
        "🔎 AnimeD23 probando:",
        candidate,
      );

      const servers =
        await getAnimeD23Servers(
          candidate,
          number,
        );

      if (
        !servers?.length
      ) {
        continue;
      }

      console.log(
        "✅ AnimeD23 encontró:",
        servers.map(
          server => ({
            name:
              server.name,
            type:
              server.type,
            url:
              server.url,
          }),
        ),
      );

      const result:
        FinalServer[] = [];

      for (
        const server of
          servers
      ) {
        if (
          !server?.url
        ) {
          continue;
        }

        // ----------------------------------------------------
        // MUY IMPORTANTE:
        //
        // AnimeD23 YA DICE si es iframe o mp4.
        //
        // NO convertir todo a "embed".
        // ----------------------------------------------------

        const type =
          server.type ===
          "mp4"
            ? "mp4"
            : "iframe";

        let name =
          String(
            server.name ||
              "",
          ).trim();

        if (!name) {
          const lower =
            server.url
              .toLowerCase();

          if (
            lower.includes(
              "mytsumi",
            )
          ) {
            name =
              "Mytsumi";
          } else if (
            lower.includes(
              "archive.org",
            )
          ) {
            name =
              "Archive";
          } else if (
            lower.includes(
              "mega.nz",
            )
          ) {
            name =
              "Mega";
          } else if (
            lower.includes(
              "ok.ru",
            )
          ) {
            name =
              "OK";
          } else {
            name =
              "AnimeD23";
          }
        }

        result.push({
          name,
          type,
          embed:
            server.url,
          lang:
            "sub",
        });
      }

      if (
        result.length
      ) {
        return result;
      }
    } catch (error) {
      console.log(
        "⚠️ AnimeD23:",
        candidate,
        error,
      );
    }
  }

  console.log(
    "❌ AnimeD23 no encontró servidores",
  );

  return [];
}


// ============================================================
// AV1
// ============================================================

async function collectAV1(
  searchTitle: string,
  number: number,
  titles: string[],
  env?: any,
): Promise<FinalServer[]> {
  try {
    console.log(
      "================================================",
    );

    console.log(
      "🟢 ANIMEAV1",
    );

    console.log(
      "================================================",
    );

    const av1Slug =
      await findAnimeAV1Slug(
        searchTitle,
        titles,
        env,
      );

    if (!av1Slug) {
      return [];
    }

    const embeds =
      await getAnimeAV1Embeds(
        av1Slug,
        number,
      );

    if (
      !embeds?.length
    ) {
      return [];
    }

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
  } catch (error) {
    console.log(
      "❌ AV1:",
      error,
    );

    return [];
  }
}


// ============================================================
// ANIMEX2
// ============================================================

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
      console.log(
        "🔎 AnimeX2:",
        candidate,
      );

      const servers =
        await getAnimeX2Servers(
          candidate,
          number,
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
    } catch (error) {
      console.log(
        "⚠️ AnimeX2:",
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

      if (!key) {
        return false;
      }

      if (
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);

      return true;
    },
  );
}


// ============================================================
// PRINCIPAL
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
    "================================================",
  );

  console.log(
    "🎬 GET ALL SERVERS",
  );

  console.log(
    "slug:",
    slug,
  );

  console.log(
    "episode:",
    number,
  );

  console.log(
    "title:",
    searchTitle,
  );

  console.log(
    "================================================",
  );

  const titles =
    await collectTitles(
      searchTitle,
      slug,
    );

  const allServers:
    FinalServer[] = [];

  // ==========================================================
  // 1. JKANIME
  //
  // MAGI / DESU DE PRIMEROS
  // ==========================================================

  const jkServers =
    await collectJKAnime(
      searchTitle,
      slug,
      number,
      anilistId,
      env,
      titles,
    );

  allServers.push(
    ...jkServers,
  );

  // ==========================================================
  // 2. ANIMED23
  //
  // SIEMPRE SE BUSCA.
  //
  // NO depende de que JKAnime haya encontrado algo.
  // ==========================================================

  const d23Servers =
    await collectAnimeD23(
      slug,
      number,
      titles,
    );

  allServers.push(
    ...d23Servers,
  );

  // ==========================================================
  // 3. AV1
  // ==========================================================

  const av1Servers =
    await collectAV1(
      searchTitle,
      number,
      titles,
      env,
    );

  allServers.push(
    ...av1Servers,
  );

  // ==========================================================
  // 4. ANIMEX2
  // ==========================================================

  const x2Servers =
    await collectAnimeX2(
      slug,
      number,
      titles,
    );

  allServers.push(
    ...x2Servers,
  );

  // ==========================================================
  // DEDUPE
  // ==========================================================

  const unique =
    dedupeServers(
      allServers,
    );

  // ==========================================================
  // ORDEN FINAL
  //
  // MAGI
  // DESU
  // AnimeD23
  // AV1
  // X2
  // ==========================================================

  const priority =
    (
      server: FinalServer,
    ): number => {
      const name =
        String(
          server.name ||
            "",
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
          "mytsumi",
        )
      ) {
        return 2;
      }

      if (
        name.includes(
          "archive",
        )
      ) {
        return 3;
      }

      if (
        name.includes(
          "mega",
        )
      ) {
        return 4;
      }

      if (
        name.includes(
          "animed23",
        )
      ) {
        return 5;
      }

      return 10;
    };

  unique.sort(
    (a, b) =>
      priority(a) -
      priority(b),
  );

  // ==========================================================
  // NOMBRADO
  //
  // SOLO Magi y Desu conservan nombre especial.
  // Los demás reciben Server 3, Server 4...
  // PERO CONSERVAMOS type.
  // ==========================================================

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
          const lower =
            String(
              server.name ||
                "",
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
              `Server ${genericNumber++}`,
          };
        },
      );

  console.log(
    "================================================",
  );

  console.log(
    "✅ SERVIDORES FINALES",
  );

  console.log(
    finalServers.map(
      server => ({
        name:
          server.name,
        type:
          server.type,
        embed:
          server.embed,
      }),
    ),
  );

  console.log(
    "================================================",
  );

 return finalServers.map(
  (server, index) => ({
    name:
      server.name ||
      `Servidor ${index + 1}`,

    type:
      "Externo",

    embed:
      server.embed,
  }),
);
