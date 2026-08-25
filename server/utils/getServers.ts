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
  getAnimeFLVServers,
} from "./animeflv";

import {
  getAnimeX2Servers,
} from "./animex2";

import {
  getAnimeD23Servers,
} from "./animed23";

import {
  getAnimeMetadata,
} from "./metadata";

interface InternalServer {
  name: string;
  url: string;
  priority: number;
  source: string;
}

export interface AggregatedServer {
  name: string;
  type: "Externo";
  embed: string;
}

/**
 * Normaliza una URL.
 */
function normalizeUrl(
  value: string,
): string | null {
  const url =
    String(value || "")
      .trim();

  if (
    !/^https?:\/\//i.test(
      url,
    )
  ) {
    return null;
  }

  return url;
}

/**
 * Agrega un servidor sin duplicarlo.
 */
function addUnique(
  target: InternalServer[],
  url: string,
  name: string,
  priority: number,
  source: string,
) {
  const clean =
    normalizeUrl(url);

  if (!clean) {
    return;
  }

  const key =
    clean
      .replace(
        /\/+$/,
        "",
      )
      .toLowerCase();

  const exists =
    target.some(
      item =>
        item.url
          .replace(
            /\/+$/,
            "",
          )
          .toLowerCase() ===
        key,
    );

  if (exists) {
    return;
  }

  target.push({
    name:
      name?.trim() ||
      source,
    url: clean,
    priority,
    source,
  });
}

/**
 * -------------------------------------------------------
 * JKANIME
 * -------------------------------------------------------
 */
async function scrapeJKAnime(
  title: string,
  titles: string[],
  env: any,
  episode: number,
): Promise<InternalServer[]> {
  const result: InternalServer[] = [];

  try {
    const slug =
      await findJKAnimeSlug(
        title,
        env,
        titles,
      );

    if (!slug) {
      console.log(
        "[JKAnime] No se encontró slug:",
        title,
      );

      return result;
    }

    console.log(
      "[JKAnime] slug:",
      slug,
    );

    const servers =
      await getJKAnimeServers(
        slug,
        episode,
      );

    console.log(
      "[JKAnime] servidores:",
      servers.length,
    );

    for (
      const server of servers
    ) {
      let priority = 10;

      const name =
        String(
          server.name ||
            "",
        )
          .toLowerCase();

      /**
       * IMPORTANTE:
       *
       * Magi primero
       * Desu segundo
       */
      if (
        name === "magi"
      ) {
        priority = 0;
      } else if (
        name === "desu"
      ) {
        priority = 1;
      } else if (
        name.includes(
          "yourupload",
        )
      ) {
        priority = 2;
      } else if (
        name.includes(
          "mega",
        )
      ) {
        priority = 3;
      } else {
        priority = 4;
      }

      addUnique(
        result,
        server.url,
        server.name ||
          "JKAnime",
        priority,
        "JKAnime",
      );
    }
  } catch (error) {
    console.error(
      "[JKAnime] error:",
      error,
    );
  }

  return result;
}

/**
 * -------------------------------------------------------
 * ANIMED23
 * -------------------------------------------------------
 */
async function scrapeAnimeD23(
  title: string,
  titles: string[],
  episode: number,
): Promise<InternalServer[]> {
  const result: InternalServer[] = [];

  try {
    const servers =
      await getAnimeD23Servers(
        title,
        episode,
        titles,
      );

    console.log(
      "[AnimeD23] servidores:",
      servers.length,
    );

    for (
      const server of servers
    ) {
      const name =
        String(
          server.name ||
            "",
        )
          .toLowerCase();

      let priority =
        20;

      if (
        name.includes(
          "moon",
        ) ||
        name.includes(
          "bysesukior",
        )
      ) {
        priority = 10;
      } else if (
        name.includes(
          "mytsumi",
        )
      ) {
        priority = 11;
      } else if (
        name.includes(
          "mega",
        )
      ) {
        priority = 12;
      } else if (
        name.includes(
          "ok",
        )
      ) {
        priority = 13;
      } else if (
        name.includes(
          "epsilon",
        ) ||
        name.includes(
          "ytplay",
        )
      ) {
        priority = 14;
      } else if (
        name.includes(
          "abyss",
        )
      ) {
        priority = 15;
      }

      addUnique(
        result,
        server.url,
        server.name ||
          "AnimeD23",
        priority,
        "AnimeD23",
      );
    }
  } catch (error) {
    console.error(
      "[AnimeD23] error:",
      error,
    );
  }

  return result;
}

/**
 * -------------------------------------------------------
 * ANIMEAV1
 * -------------------------------------------------------
 */
async function scrapeAnimeAV1(
  title: string,
  titles: string[],
  env: any,
  episode: number,
): Promise<InternalServer[]> {
  const result: InternalServer[] = [];

  try {
    const slug =
      await findAnimeAV1Slug(
        title,
        titles,
        env,
      );

    if (!slug) {
      console.log(
        "[AnimeAV1] No se encontró slug:",
        title,
      );

      return result;
    }

    console.log(
      "[AnimeAV1] slug:",
      slug,
    );

    const embeds =
      await getAnimeAV1Embeds(
        slug,
        episode,
      );

    console.log(
      "[AnimeAV1] servidores:",
      embeds.length,
    );

    for (
      const embed of embeds
    ) {
      const server =
        String(
          embed.server ||
            "",
        )
          .toLowerCase();

      let priority =
        30;

      if (
        server === "hls"
      ) {
        priority = 30;
      } else if (
        server === "byse"
      ) {
        priority = 31;
      } else if (
        server === "mega"
      ) {
        priority = 32;
      } else if (
        server ===
        "mp4upload"
      ) {
        priority = 33;
      } else {
        priority = 34;
      }

      addUnique(
        result,
        embed.url,
        embed.server ||
          "AnimeAV1",
        priority,
        "AnimeAV1",
      );
    }
  } catch (error) {
    console.error(
      "[AnimeAV1] error:",
      error,
    );
  }

  return result;
}

/**
 * -------------------------------------------------------
 * ANIMEFLV
 * -------------------------------------------------------
 */
async function scrapeAnimeFLV(
  title: string,
  episode: number,
): Promise<InternalServer[]> {
  const result: InternalServer[] = [];

  try {
    const servers =
      await getAnimeFLVServers(
        title,
        episode,
      );

    console.log(
      "[AnimeFLV] servidores:",
      servers.length,
    );

    for (
      const server of servers
    ) {
      const name =
        String(
          server.name ||
            "",
        )
          .toLowerCase();

      let priority =
        40;

      if (
        name === "hls"
      ) {
        priority = 40;
      } else if (
        name === "byse"
      ) {
        priority = 41;
      } else if (
        name === "mega"
      ) {
        priority = 42;
      } else if (
        name ===
        "mp4upload"
      ) {
        priority = 43;
      } else {
        priority = 44;
      }

      addUnique(
        result,
        server.url,
        server.name ||
          "AnimeFLV",
        priority,
        "AnimeFLV",
      );
    }
  } catch (error) {
    console.error(
      "[AnimeFLV] error:",
      error,
    );
  }

  return result;
}

/**
 * -------------------------------------------------------
 * ANIMEX2
 * -------------------------------------------------------
 */
async function scrapeAnimeX2(
  title: string,
  episode: number,
): Promise<InternalServer[]> {
  const result: InternalServer[] = [];

  try {
    const normalized =
      String(title || "")
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

    if (!normalized) {
      return result;
    }

    const variants =
      new Set<string>();

    variants.add(
      normalized,
    );

    variants.add(
      normalized.replace(
        /-(?:season|temporada|part|parte)-?\d+$/i,
        "",
      ),
    );

    variants.add(
      normalized.replace(
        /-(?:19|20)\d{2}$/,
        "",
      ),
    );

    for (
      const variant of variants
    ) {
      if (!variant) {
        continue;
      }

      const servers =
        await getAnimeX2Servers(
          variant,
          episode,
        );

      if (
        !servers.length
      ) {
        continue;
      }

      for (
        const server of servers
      ) {
        addUnique(
          result,
          server.url,
          server.name ||
            "AnimeX2",
          50,
          "AnimeX2",
        );
      }

      /**
       * Si una variante funcionó,
       * todavía conservamos todos sus servidores.
       */
      break;
    }
  } catch (error) {
    console.error(
      "[AnimeX2] error:",
      error,
    );
  }

  return result;
}

/**
 * -------------------------------------------------------
 * AGREGADOR
 * -------------------------------------------------------
 */
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
}): Promise<AggregatedServer[]> {
  const input =
    title?.trim() ||
    slug;

  /**
   * Metadata una sola vez.
   */
  let metadata = {
    titles: [] as string[],
    malId: null as number | null,
    anilistId: null as number | null,
  };

  try {
    metadata =
      await getAnimeMetadata(
        input,
        anilistId,
      );
  } catch (error) {
    console.error(
      "[Metadata] error:",
      error,
    );
  }

  const titles = [
    input,
    slug,
    ...(metadata.titles || []),
  ]
    .filter(Boolean);

  const uniqueTitles =
    [
      ...new Set(
        titles,
      ),
    ];

  console.log(
    "[Aggregator] título:",
    input,
  );

  console.log(
    "[Aggregator] títulos:",
    uniqueTitles,
  );

  /**
   * TODOS los scrapers se ejecutan.
   *
   * Un fallo de uno NO mata los otros.
   */
  const tasks = [
    scrapeJKAnime(
      input,
      uniqueTitles,
      env,
      number,
    ),

    scrapeAnimeD23(
      input,
      uniqueTitles,
      number,
    ),

    scrapeAnimeAV1(
      input,
      uniqueTitles,
      env,
      number,
    ),

    scrapeAnimeFLV(
      input,
      number,
    ),

    scrapeAnimeX2(
      input,
      number,
    ),
  ];

  const settled =
    await Promise.allSettled(
      tasks,
    );

  const servers:
    InternalServer[] = [];

  for (
    const item of settled
  ) {
    if (
      item.status ===
      "fulfilled"
    ) {
      servers.push(
        ...item.value,
      );
    } else {
      console.error(
        "[Aggregator] scraper rechazado:",
        item.reason,
      );
    }
  }

  /**
   * Orden global.
   */
  servers.sort(
    (a, b) =>
      a.priority -
      b.priority,
  );

  /**
   * Deduplicación final.
   */
  const seen =
    new Set<string>();

  const final:
    InternalServer[] = [];

  for (
    const server of servers
  ) {
    const key =
      server.url
        .replace(
          /\/+$/,
          "",
        )
        .toLowerCase();

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    final.push(
      server,
    );
  }

  console.log(
    "[Aggregator] TOTAL:",
    final.length,
  );

  console.log(
    "[Aggregator] servidores:",
    final.map(
      server =>
        `${server.name} [${server.source}]`,
    ),
  );

  /**
   * NO eliminamos servidores
   * innecesariamente.
   *
   * Si hay 2, devuelve 2.
   * Si hay 7, devuelve 7.
   * Si hay 20, devuelve 20.
   */
  return final.map(
    server => ({
      name:
        server.name,
      type:
        "Externo" as const,
      embed:
        server.url,
    }),
  );
}

/**
 * -------------------------------------------------------
 * SUBTÍTULOS
 * -------------------------------------------------------
 */
export async function getSubtitles(
  slug: string,
  episode: number,
) {
  return getJKAnimeSubtitles(
    slug,
    episode,
  );
}
