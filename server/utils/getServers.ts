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
  url: string;
  priority: number;
}

export interface AggregatedServer {
  name: string;
  type: "Externo";
  embed: string;
}

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

function addUnique(
  target: InternalServer[],
  url: string,
  priority: number,
) {
  const clean =
    normalizeUrl(url);

  if (!clean) {
    return;
  }

  const key =
    clean
      .replace(/\/+$/, "")
      .toLowerCase();

  if (
    target.some(
      item =>
        item.url
          .replace(
            /\/+$/,
            "",
          )
          .toLowerCase() ===
        key,
    )
  ) {
    return;
  }

  target.push({
    url: clean,
    priority,
  });
}

/**
 * JKAnime conserva la lógica vieja:
 *
 * video[0] = Desu
 * video[1] = Magi
 *
 * pero la búsqueda del slug ahora utiliza
 * jkSearch + titleMatcher mejorados.
 */
async function scrapeJKAnime(
  title: string,
  titles: string[],
  env: any,
  episode: number,
): Promise<InternalServer[]> {
  const result:
    InternalServer[] = [];

  const slug =
    await findJKAnimeSlug(
      title,
      env,
      titles,
    );

  if (!slug) {
    return result;
  }

  const servers =
    await getJKAnimeServers(
      slug,
      episode,
    );

  for (
    let i = 0;
    i < servers.length;
    i++
  ) {
    const server =
      servers[i];

    /*
     * Conservamos prioridad del extractor
     * antiguo sin tener que modificar jkanime.ts.
     */
    let priority = 2;

    if (i === 0) {
      priority = 0;
    } else if (i === 1) {
      priority = 1;
    }

    addUnique(
      result,
      server.url,
      priority,
    );
  }

  return result;
}

/**
 * AnimeD23
 *
 * Prioridad inmediatamente después
 * de JKAnime.
 */
async function scrapeAnimeD23(
  title: string,
  titles: string[],
  episode: number,
): Promise<InternalServer[]> {
  const result:
    InternalServer[] = [];

  const servers =
    await getAnimeD23Servers(
      title,
      episode,
      titles,
    );

  for (
    const server of servers
  ) {
    const name =
      server.name
        .toLowerCase();

    let priority = 15;

    if (
      name.includes(
        "moon",
      ) ||
      name.includes(
        "bysesukior",
      )
    ) {
      priority = 3;
    } else if (
      name.includes(
        "mytsumi",
      )
    ) {
      priority = 4;
    } else if (
      name.includes(
        "mega",
      )
    ) {
      priority = 5;
    } else if (
      name.includes(
        "ok",
      )
    ) {
      priority = 6;
    } else if (
      name.includes(
        "epsilon",
      ) ||
      name.includes(
        "ytplay",
      )
    ) {
      priority = 7;
    } else if (
      name.includes(
        "abyss",
      )
    ) {
      priority = 8;
    }

    addUnique(
      result,
      server.url,
      priority,
    );
  }

  return result;
}

/**
 * AnimeAV1
 *
 * No se utiliza proxy-zilla aquí.
 *
 * Esto es importante porque si el proxy
 * era el que estaba provocando el bloqueo,
 * ahora tu frontend recibe el embed original.
 */
async function scrapeAnimeAV1(
  title: string,
  titles: string[],
  env: any,
  episode: number,
): Promise<InternalServer[]> {
  const result:
    InternalServer[] = [];

  const slug =
    await findAnimeAV1Slug(
      title,
      titles,
      env,
    );

  if (!slug) {
    return result;
  }

  const embeds =
    await getAnimeAV1Embeds(
      slug,
      episode,
    );

  for (
    const embed of embeds
  ) {
    const server =
      embed.server
        .toLowerCase();

    let priority = 20;

    if (
      server === "hls"
    ) {
      priority = 20;
    } else if (
      server === "byse"
    ) {
      priority = 21;
    } else if (
      server === "mega"
    ) {
      priority = 22;
    } else if (
      server === "mp4upload"
    ) {
      priority = 23;
    }

    addUnique(
      result,
      embed.url,
      priority,
    );
  }

  return result;
}

/**
 * AnimeFLV
 *
 * Conservamos su extractor independiente.
 */
async function scrapeAnimeFLV(
  title: string,
  episode: number,
): Promise<InternalServer[]> {
  const result:
    InternalServer[] = [];

  const servers =
    await getAnimeFLVServers(
      title,
      episode,
    );

  for (
    const server of servers
  ) {
    const name =
      server.name
        .toLowerCase();

    let priority = 30;

    if (
      name === "hls"
    ) {
      priority = 30;
    } else if (
      name === "byse"
    ) {
      priority = 31;
    } else if (
      name === "mega"
    ) {
      priority = 32;
    } else if (
      name === "mp4upload"
    ) {
      priority = 33;
    } else {
      priority = 34;
    }

    addUnique(
      result,
      server.url,
      priority,
    );
  }

  return result;
}

/**
 * AnimeX2
 */
async function scrapeAnimeX2(
  title: string,
  episode: number,
): Promise<InternalServer[]> {
  const result:
    InternalServer[] = [];

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
    const servers =
      await getAnimeX2Servers(
        variant,
        episode,
      );

    if (!servers.length) {
      continue;
    }

    for (
      const server of servers
    ) {
      addUnique(
        result,
        server.url,
        40,
      );
    }

    break;
  }

  return result;
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
}): Promise<AggregatedServer[]> {
  const input =
    title?.trim() ||
    slug;

  /*
   * AniList se consulta UNA sola vez.
   *
   * No queremos que cada scraper haga
   * su propia consulta.
   */
  const metadata =
    await getAnimeMetadata(
      input,
      anilistId,
    );

  const titles = [
    input,
    slug,
    ...(metadata.titles || []),
  ].filter(Boolean);

  const uniqueTitles =
    [
      ...new Set(
        titles,
      ),
    ];

  /*
   * TODOS los scrapers son independientes.
   *
   * Si AV1 devuelve error:
   * no afecta JKAnime.
   *
   * Si AnimeD23 devuelve error:
   * no afecta AnimeFLV.
   *
   * Si AnimeFLV está caído:
   * tampoco afecta los demás.
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
    }
  }

  /*
   * JKAnime siempre arriba,
   * después D23,
   * luego AV1,
   * FLV,
   * X2.
   */
  servers.sort(
    (a, b) =>
      a.priority -
      b.priority,
  );

  /*
   * Deduplicación.
   */
  const seen =
    new Set<string>();

  const finalServers:
    string[] = [];

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
    finalServers.push(
      server.url,
    );
  }

  /*
   * Tu frontend sigue recibiendo exactamente
   * la estructura que espera:
   *
   * Server 1
   * Server 2
   * Server 3...
   */
  return finalServers
    .slice(0, 15)
    .map(
      (
        url,
        index,
      ) => ({
        name:
          `Server ${index + 1}`,

        type:
          "Externo" as const,

        embed:
          url,
      }),
    );
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
