import {
  getJKAnimeServers,
  getJKAnimeLatestEpisode,
} from "./jkanime";

import {
  findAnimeAV1Slug,
  getAnimeAV1Embeds,
} from "./animeav1";

import { findJKAnimeSlug } from "./jkSearch";
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
  const allServers: any[] = [];

  let latestEpisode: number | null = null;

  const searchTitle = title || slug;

  // ============================================================
  // TÍTULOS ALTERNATIVOS
  // ============================================================

  let extraTitles: string[] = [];

  try {
    const meta = await getAnimeMetadata(searchTitle);

    if (meta?.titles) {
      extraTitles = meta.titles.filter(
        (x: any) =>
          typeof x === "string" &&
          x.trim().length > 1,
      );
    }
  } catch {}

  // ============================================================
  // 1. JKANIME
  // ============================================================

  try {
    const jkSlug = await findJKAnimeSlug(
      {
        slug,
        title: searchTitle,
        anilistId,
      },
      env,
      extraTitles,
    );

    if (jkSlug) {
      const jkServers =
        await getJKAnimeServers(
          jkSlug,
          number,
        );

      /*
       * IMPORTANTE:
       * Magi y Desu primero.
       */

      const priority = [
        "magi",
        "desu",
      ];

      jkServers.sort((a, b) => {
        const aName =
          String(a.name || "").toLowerCase();

        const bName =
          String(b.name || "").toLowerCase();

        const aIndex =
          priority.findIndex(p =>
            aName.includes(p),
          );

        const bIndex =
          priority.findIndex(p =>
            bName.includes(p),
          );

        const aa =
          aIndex === -1
            ? 999
            : aIndex;

        const bb =
          bIndex === -1
            ? 999
            : bIndex;

        return aa - bb;
      });

      for (const server of jkServers) {
        if (!server?.url) continue;

        allServers.push({
          name: server.name,
          type: "embed",
          embed: server.url,
          lang: "sub",
        });
      }

      const jkLatest =
        await getJKAnimeLatestEpisode(
          jkSlug,
        );

      if (jkLatest) {
        latestEpisode = jkLatest;
      }
    }
  } catch (error) {
    console.log(
      "⚠️ JKAnime:",
      error,
    );
  }

  // ============================================================
  // 2. AV1
  // ============================================================

  try {
    const av1Slug =
      await findAnimeAV1Slug(
        searchTitle,
        extraTitles,
        env,
      );

    if (av1Slug) {
      const av1Servers =
        await getAnimeAV1Embeds(
          av1Slug,
          number,
        );

      for (const server of av1Servers) {
        if (!server?.url) continue;

        allServers.push({
          name:
            server.server ||
            "Server",
          type: "embed",
          embed: server.url,
          lang:
            server.language ||
            "sub",
        });
      }
    }
  } catch (error) {
    console.log(
      "⚠️ AnimeAV1:",
      error,
    );
  }

  // ============================================================
  // DEDUPLICACIÓN
  // ============================================================

  const seen =
    new Set<string>();

  const unique =
    allServers.filter(
      server => {
        if (!server?.embed) {
          return false;
        }

        const normalized =
          String(server.embed)
            .trim()
            .replace(/\/+$/, "")
            .toLowerCase();

        if (!normalized) {
          return false;
        }

        if (
          seen.has(normalized)
        ) {
          return false;
        }

        seen.add(normalized);

        return true;
      },
    );

  // ============================================================
  // RENOMBRADO GENÉRICO
  // ============================================================

  const finalServers =
    unique.map(
      (server, index) => ({
        ...server,

        /*
         * Mantiene Magi / Desu
         * como nombres útiles.
         *
         * El resto queda como
         * Server 3, Server 4...
         */

        name:
          /magi/i.test(
            server.name || "",
          )
            ? "Magi"
            : /desu/i.test(
                server.name || "",
              )
            ? "Desu"
            : `Server ${index + 1}`,
      }),
    );

  return {
    servers:
      finalServers.slice(0, 15),

    latestEpisode,

    success:
      finalServers.length > 0,
  };
}
