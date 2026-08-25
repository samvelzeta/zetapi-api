import { getJKAnimeServers } from "./jkanime";
import { findJKAnimeSlug } from "./jkSearch";

import {
  getAnimeAV1Embeds,
  findAnimeAV1Slug,
} from "./animeav1";

import { getAnimeX2Servers } from "./animex2";

import { getAnimeMetadata } from "./metadata";

import { getAnimeD23Servers } from "./animed23";

import {
  findAnimeFLVSlug,
  getAnimeFLVServers,
} from "./animeflv";

export interface AggregatedServer {
  name: string;
  type: "Externo";
  embed: string;
}

function cleanSlug(
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
}

function generateFallbackSlugs(
  input: string,
  titles: string[],
): string[] {
  const values = [
    input,
    ...titles,
  ];

  const variants =
    new Set<string>();

  for (
    const value of values
  ) {
    const base =
      cleanSlug(value);

    if (!base) {
      continue;
    }

    variants.add(base);

    const noSeason =
      base
        .replace(
          /-(?:season|temporada|part|parte|cour)-?\d+$/i,
          "",
        )
        .replace(
          /-\d+(?:st|nd|rd|th)-(?:season|temporada)$/i,
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

    if (noSeason) {
      variants.add(
        noSeason,
      );
    }

    const noYear =
      base.replace(
        /-(?:19|20)\d{2}$/,
        "",
      );

    if (noYear) {
      variants.add(
        noYear,
      );
    }

    const words =
      base
        .split("-")
        .filter(Boolean);

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
  }

  return [
    ...variants,
  ].slice(0, 6);
}

function normalizeEmbed(
  value: string,
): string | null {
  if (!value) {
    return null;
  }

  const url =
    value.trim();

  if (
    !/^https?:\/\//i.test(
      url,
    )
  ) {
    return null;
  }

  return url;
}

function addServer(
  target: AggregatedServer[],
  source: string,
  name: string,
  url: string,
) {
  const embed =
    normalizeEmbed(url);

  if (!embed) {
    return;
  }

  target.push({
    name: name
      ? `${source} • ${name}`
      : source,

    type: "Externo",

    embed,
  });
}

async function resolveJKAnime(
  input: string,
  titles: string[],
  env: any,
  episode: number,
): Promise<AggregatedServer[]> {
  const slug =
    await findJKAnimeSlug(
      input,
      env,
      titles,
    );

  if (!slug) {
    return [];
  }

  const servers =
    await getJKAnimeServers(
      slug,
      episode,
    );

  return servers.map(
    server => ({
      name:
        `JKAnime • ${server.name}`,

      type:
        "Externo" as const,

      embed:
        server.url,
    }),
  );
}

async function resolveAnimeFLV(
  input: string,
  titles: string[],
  env: any,
  episode: number,
): Promise<AggregatedServer[]> {
  const slug =
    await findAnimeFLVSlug(
      input,
      titles,
      env,
    );

  if (!slug) {
    return [];
  }

  const servers =
    await getAnimeFLVServers(
      slug,
      episode,
    );

  return servers.map(
    server => ({
      name:
        `AnimeFLV • ${server.name}`,

      type:
        "Externo" as const,

      embed:
        server.url,
    }),
  );
}

async function resolveAnimeAV1(
  input: string,
  titles: string[],
  env: any,
  episode: number,
): Promise<AggregatedServer[]> {
  const slug =
    await findAnimeAV1Slug(
      input,
      titles,
      env,
    );

  if (!slug) {
    return [];
  }

  const embeds =
    await getAnimeAV1Embeds(
      slug,
      episode,
    );

  return embeds.map(
    embed => ({
      name:
        `AnimeAV1 • ${embed.server}` +
        (
          embed.language ===
          "dub"
            ? " • DUB"
            : " • SUB"
        ),

      type:
        "Externo" as const,

      /*
       * MUY IMPORTANTE:
       *
       * Se devuelve el iframe nativo.
       * No se envuelve en /proxy-zilla.
       */
      embed:
        embed.url,
    }),
  );
}

async function resolveAnimeX2(
  input: string,
  titles: string[],
  episode: number,
): Promise<AggregatedServer[]> {
  const results:
    AggregatedServer[] =
    [];

  for (
    const candidate of
    generateFallbackSlugs(
      input,
      titles,
    )
  ) {
    const servers =
      await getAnimeX2Servers(
        candidate,
        episode,
      );

    if (!servers.length) {
      continue;
    }

    for (
      const server of
      servers
    ) {
      addServer(
        results,
        "AnimeX2",
        server.name,
        server.url,
      );
    }

    if (results.length) {
      break;
    }
  }

  return results;
}

async function resolveAnimeD23(
  input: string,
  titles: string[],
  episode: number,
): Promise<AggregatedServer[]> {
  const results:
    AggregatedServer[] =
    [];

  for (
    const candidate of
    generateFallbackSlugs(
      input,
      titles,
    )
  ) {
    const servers =
      await getAnimeD23Servers(
        candidate,
        episode,
      );

    if (!servers.length) {
      continue;
    }

    for (
      const server of
      servers
    ) {
      addServer(
        results,
        "AnimeD23",
        "",
        server.url,
      );
    }

    if (results.length) {
      break;
    }
  }

  return results;
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
    title || slug;

  /*
   * Si existe AniList ID usamos ID.
   * Eso elimina falsos positivos por título.
   */
  const meta =
    await getAnimeMetadata(
      input,
      anilistId,
    );

  const titles = [
    ...new Set(
      [
        input,
        slug,
        ...(meta.titles || []),
      ].filter(Boolean),
    ),
  ];

  /*
   * Todas las fuentes se consultan
   * independientemente.
   *
   * Si una falla, las demás continúan.
   */
  const tasks = [
    resolveJKAnime(
      input,
      titles,
      env,
      number,
    ),

    resolveAnimeFLV(
      input,
      titles,
      env,
      number,
    ),

    resolveAnimeAV1(
      input,
      titles,
      env,
      number,
    ),

    resolveAnimeX2(
      input,
      titles,
      number,
    ),

    resolveAnimeD23(
      input,
      titles,
      number,
    ),
  ];

  const settled =
    await Promise.allSettled(
      tasks,
    );

  const allServers:
    AggregatedServer[] =
    [];

  for (
    const result of
    settled
  ) {
    if (
      result.status ===
      "fulfilled"
    ) {
      allServers.push(
        ...result.value,
      );
    }
  }

  /*
   * Deduplicación.
   */
  const seen =
    new Set<string>();

  const unique =
    allServers.filter(
      server => {
        const key =
          server.embed
            .replace(
              /^https?:\/\//i,
              "",
            )
            .split("?")[0]
            .replace(
              /\/$/,
              "",
            )
            .toLowerCase();

        if (
          !key ||
          seen.has(key)
        ) {
          return false;
        }

        seen.add(key);

        return true;
      },
    );

  /*
   * Prioridad:
   *
   * 0 Desu
   * 1 Magi
   * 2 otros JKAnime
   * 3 AnimeFLV
   * 4 AnimeAV1
   * 5 AnimeX2
   * 6 AnimeD23
   */
  unique.sort(
    (a, b) => {
      const score =
        (name: string) => {
          const n =
            name.toLowerCase();

          if (
            n.includes(
              "jkanime • desu",
            )
          ) {
            return 0;
          }

          if (
            n.includes(
              "jkanime • magi",
            )
          ) {
            return 1;
          }

          if (
            n.startsWith(
              "jkanime",
            )
          ) {
            return 2;
          }

          if (
            n.startsWith(
              "animeflv",
            )
          ) {
            return 3;
          }

          if (
            n.startsWith(
              "animeav1",
            )
          ) {
            return 4;
          }

          if (
            n.startsWith(
              "animex2",
            )
          ) {
            return 5;
          }

          if (
            n.startsWith(
              "animed23",
            )
          ) {
            return 6;
          }

          return 10;
        };

      return (
        score(a.name) -
        score(b.name)
      );
    },
  );

  return unique.slice(
    0,
    15,
  );
}
