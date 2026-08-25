import { fetchHtml } from "./fetcher";
import { stripHtml } from "./htmlUtils";

import {
  buildSearchQueries,
  normalizeTitle,
  rankCandidates,
  TitleCandidate,
} from "./titleMatcher";

const memoryCache =
  new Map<string, string>();

interface JKSearchResult
  extends TitleCandidate {
  url: string;
}

function extractResults(
  html: string,
): JKSearchResult[] {
  const results: JKSearchResult[] = [];

  const regex =
    /<h2\b[^>]*class=["'][^"']*portada-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/gi;

  let match:
    | RegExpExecArray
    | null;

  while (
    (match =
      regex.exec(html)) !== null
  ) {
    const block =
      match[1];

    const anchor =
      block.match(
        /<a\b([^>]*)>([\s\S]*?)<\/a>/i,
      );

    if (!anchor) {
      continue;
    }

    const attrs =
      anchor[1];

    const hrefMatch =
      attrs.match(
        /href\s*=\s*["']([^"']+)["']/i,
      );

    if (!hrefMatch) {
      continue;
    }

    const href =
      hrefMatch[1];

    const slugMatch =
      href.match(
        /\/([^/?#]+)\/?$/,
      );

    if (!slugMatch) {
      continue;
    }

    const slug =
      slugMatch[1];

    if (
      !slug ||
      /^(buscar|directorio|genero|horario|login|usuario|ajax)$/i.test(
        slug,
      )
    ) {
      continue;
    }

    const titleAttr =
      attrs.match(
        /title\s*=\s*["']([^"']+)["']/i,
      );

    const title =
      stripHtml(
        titleAttr?.[1] ||
          anchor[2],
      );

    if (!title) {
      continue;
    }

    results.push({
      slug,
      title,
      url: `https://jkanime.net/${slug}/`,
    });
  }

  // Fallback.
  if (!results.length) {
    const fallback =
      /<a\b([^>]*)href=["'](?:https?:\/\/jkanime\.net)?\/([^/"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;

    while (
      (match =
        fallback.exec(html)) !== null
    ) {
      const slug =
        match[2];

      const attrs =
        `${match[1]} ${match[3]}`;

      if (
        /^(buscar|directorio|genero|horario|login|usuario|ajax|tipo)$/i.test(
          slug,
        )
      ) {
        continue;
      }

      if (
        !/portada|title|let-link/i.test(
          attrs + match[4],
        )
      ) {
        continue;
      }

      const title =
        stripHtml(
          match[4],
        );

      if (
        title.length < 2
      ) {
        continue;
      }

      results.push({
        slug,
        title,
        url: `https://jkanime.net/${slug}/`,
      });
    }
  }

  const unique =
    new Map<
      string,
      JKSearchResult
    >();

  for (
    const result of
    results
  ) {
    if (
      !unique.has(
        result.slug,
      )
    ) {
      unique.set(
        result.slug,
        result,
      );
    }
  }

  return [
    ...unique.values(),
  ];
}

async function searchJKAnime(
  query: string,
  page = 1,
): Promise<JKSearchResult[]> {
  const url =
    `https://jkanime.net/buscar/${encodeURIComponent(query)}/${page}/`;

  const html =
    await fetchHtml(url);

  if (!html) {
    return [];
  }

  return extractResults(
    html,
  );
}

export async function findJKAnimeSlug(
  input: string,
  env?: any,
  allTitles: string[] = [],
  _malId: number | null = null,
): Promise<string | null> {
  const key =
    `jkanime:${normalizeTitle(input)}`;

  const cachedMemory =
    memoryCache.get(key);

  if (cachedMemory) {
    return cachedMemory;
  }

  if (env?.SLUG_CACHE) {
    try {
      const cached =
        await env.SLUG_CACHE.get(
          key,
        );

      if (cached) {
        memoryCache.set(
          key,
          cached,
        );

        return cached;
      }
    } catch {}
  }

  const queries =
    buildSearchQueries(
      input,
      allTitles,
    );

  const candidates =
    new Map<
      string,
      JKSearchResult
    >();

  const primary =
    await Promise.all(
      queries
        .slice(0, 5)
        .map(query =>
          searchJKAnime(
            query,
            1,
          ),
        ),
    );

  for (
    const result of
    primary.flat()
  ) {
    candidates.set(
      result.slug,
      result,
    );
  }

  let ranked =
    rankCandidates(
      [...candidates.values()],
      [input, ...allTitles],
    );

  if (
    !ranked[0] ||
    ranked[0].score < 86
  ) {
    const secondary =
      await Promise.all(
        queries
          .slice(5, 10)
          .map(query =>
            searchJKAnime(
              query,
              1,
            ),
          ),
      );

    for (
      const result of
      secondary.flat()
    ) {
      candidates.set(
        result.slug,
        result,
      );
    }

    ranked =
      rankCandidates(
        [...candidates.values()],
        [input, ...allTitles],
      );
  }

  if (!ranked.length) {
    return null;
  }

  const best =
    ranked[0];

  if (
    !best ||
    best.score < 68
  ) {
    return null;
  }

  memoryCache.set(
    key,
    best.slug,
  );

  if (env?.SLUG_CACHE) {
    try {
      await env.SLUG_CACHE.put(
        key,
        best.slug,
        {
          expirationTtl:
            60 * 60 * 24 * 7,
        },
      );
    } catch {}
  }

  return best.slug;
}
