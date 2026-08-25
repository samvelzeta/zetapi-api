import {
  findJKAnimeSlug,
} from "./jkSearch";

import {
  getJKAnimeServers,
} from "./jkanime";

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
    String(value || "").trim();

  if (
    !/^https?:\/\//i.test(url)
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

  if (
    target.some(
      item =>
        item.url
          .replace(
            /\/+$/,
            "",
          )
          .toLowerCase() ===
        clean
          .replace(
            /\/+$/,
            "",
          )
          .toLowerCase(),
    )
  ) {
    return;
  }

  target.push({
    url: clean,
    priority,
  });
}

function slugFallbacks(
  value: string,
): string[] {
  const normalized =
    String(value || "")
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

  const variants =
    new Set<string>();

  if (!normalized) {
    return [];
  }

  variants.add(
    normalized,
  );

  variants.add(
    normalized.replace(
      /-(?:season|temporada|part|parte|cour)-?\d+$/i,
      "",
    ),
  );

  variants.add(
    normalized.replace(
      /-(?:19|20)\d{2}$/,
      "",
    ),
  );

  return [
    ...variants,
  ].filter(Boolean);
}

async function scrapeJKAnime(
  title: string,
  titles: string[],
  env: any,
  episode: number,
): Promise<InternalServer[]> {
  const result: InternalServer[] =
    [];

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
    const server of servers
  ) {
    addUnique(
      result,
      server.url,
      server.name
        .toLowerCase() ===
      "desu"
        ? 0
        : 1,
    );
  }

  return result;
}

async function scrapeAnimeAV1(
  title: string,
  titles: string[],
  env: any,
  episode: number,
): Promise<InternalServer[]> {
  const result: InternalServer[] =
    [];

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
      embed.server.toLowerCase();

    /*
     * Zilla primero.
     */
    let priority = 2;

    if (
      server === "hls"
    ) {
      priority = 2;
    } else if (
      server === "byse"
    ) {
      priority = 3;
    } else if (
      server === "mega"
    ) {
      priority = 4;
    } else if (
      server === "mp4upload"
    ) {
      priority = 5;
    }

    addUnique(
      result,
      embed.url,
      priority,
    );
  }

  return result;
}

async function scrapeAnimeFLV(
  title: string,
  episode: number,
): Promise<InternalServer[]> {
  const result: InternalServer[] =
    [];

  const servers =
    await getAnimeFLVServers(
      title,
      episode,
    );

  for (
    const server of servers
  ) {
    const name =
      server.name.toLowerCase();

    let priority = 6;

    if (name === "hls") {
      priority = 6;
    } else if (
      name === "byse"
    ) {
      priority = 7;
    } else if (
      name === "mega"
    ) {
      priority = 8;
    } else if (
      name === "mp4upload"
    ) {
      priority = 9;
    }

    addUnique(
      result,
      server.url,
      priority,
    );
  }

  return result;
}

async function scrapeAnimeX2(
  title: string,
  episode: number,
): Promise<InternalServer[]> {
  const result: InternalServer[] =
    [];

  for (
    const slug of
    slugFallbacks(title)
  ) {
    const servers =
      await getAnimeX2Servers(
        slug,
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
        20,
      );
    }

    break;
  }

  return result;
}

async function scrapeAnimeD23(
  title: string,
  episode: number,
): Promise<InternalServer[]> {
  const result: InternalServer[] =
    [];

  for (
    const slug of
    slugFallbacks(title)
  ) {
    const servers =
      await getAnimeD23Servers(
        slug,
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
        30,
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
   * AniList solo para conseguir
   * títulos alternativos.
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
   * IMPORTANTE:
   *
   * Todas las fuentes se consultan.
   *
   * No hacemos:
   *
   * JKAnime -> si encontró algo
   * STOP.
   *
   * Hacemos:
   *
   * JKAnime
   * AnimeAV1
   * AnimeFLV
   * AnimeX2
   * AnimeD23
   *
   * y juntamos todo.
   */
  const tasks = [
    scrapeJKAnime(
      input,
      uniqueTitles,
      env,
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

    scrapeAnimeD23(
      input,
      number,
    ),
  ];

  const settled =
    await Promise.allSettled(
      tasks,
    );

  const servers:
    InternalServer[] =
    [];

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
   * Orden interno.
   */
  servers.sort(
    (a, b) =>
      a.priority -
      b.priority,
  );

  /*
   * Deduplicación final.
   */
  const finalUrls: string[] =
    [];

  const seen =
    new Set<string>();

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

    finalUrls.push(
      server.url,
    );
  }

  /*
   * AQUÍ está lo que pediste:
   *
   * NO:
   *
   * JKAnime • Desu
   * AnimeAV1 • Mega
   *
   * SÍ:
   *
   * Server 1
   * Server 2
   * Server 3
   * ...
   */
  return finalUrls
    .slice(0, 15)
    .map(
      (url, index) => ({
        name:
          `Server ${index + 1}`,

        type:
          "Externo" as const,

        embed:
          url,
      }),
    );
}
