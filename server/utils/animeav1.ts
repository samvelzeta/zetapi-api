import { fetchHtml } from "./fetcher";
import { stripHtml } from "./htmlUtils";
import {
  buildSearchQueries,
  normalizeTitle,
  rankCandidates,
  TitleCandidate,
} from "./titleMatcher";

const BASE =
  "https://animeav1.com";

const memoryCache =
  new Map<string, string>();

export interface AV1Embed {
  server: string;
  url: string;
  language?:
    | "sub"
    | "dub";
}

interface SearchResult
  extends TitleCandidate {
  url: string;
}

function extractSearchResults(
  html: string,
): SearchResult[] {
  const results: SearchResult[] = [];

  const articleRegex =
    /<article\b[^>]*>([\s\S]*?)<\/article>/gi;

  let match:
    | RegExpExecArray
    | null;

  while (
    (match =
      articleRegex.exec(html)) !== null
  ) {
    const block =
      match[1];

    const hrefMatch =
      block.match(
        /href=["']\/media\/([^"']+)["']/i,
      );

    const titleMatch =
      block.match(
        /<h3\b[^>]*>([\s\S]*?)<\/h3>/i,
      );

    if (
      !hrefMatch ||
      !titleMatch
    ) {
      continue;
    }

    const slug =
      hrefMatch[1].trim();

    const title =
      stripHtml(
        titleMatch[1],
      );

    if (
      slug &&
      title
    ) {
      results.push({
        slug,
        title,
        url: `${BASE}/media/${slug}`,
      });
    }
  }

  if (results.length) {
    return dedupe(results);
  }

  const fallback =
    /<a\b[^>]*href=["']\/media\/([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  while (
    (match =
      fallback.exec(html)) !== null
  ) {
    const slug =
      match[1].trim();

    const titleMatch =
      match[2].match(
        /<h3\b[^>]*>([\s\S]*?)<\/h3>/i,
      );

    const title =
      stripHtml(
        titleMatch?.[1] ||
          match[2],
      );

    if (
      slug &&
      title &&
      title.length < 180
    ) {
      results.push({
        slug,
        title,
        url: `${BASE}/media/${slug}`,
      });
    }
  }

  return dedupe(results);
}

function dedupe(
  results: SearchResult[],
): SearchResult[] {
  const map =
    new Map<string, SearchResult>();

  for (
    const result of
    results
  ) {
    if (
      !map.has(
        result.slug,
      )
    ) {
      map.set(
        result.slug,
        result,
      );
    }
  }

  return [
    ...map.values(),
  ];
}

export async function searchAnimeAV1(
  query: string,
  page = 1,
): Promise<SearchResult[]> {
  const params =
    new URLSearchParams();

  params.set(
    "search",
    query,
  );

  if (page > 1) {
    params.set(
      "page",
      String(page),
    );
  }

  const html =
    await fetchHtml(
      `${BASE}/catalogo?${params.toString()}`,
    );

  if (!html) {
    return [];
  }

  return extractSearchResults(
    html,
  );
}

export async function findAnimeAV1Slug(
  input: string,
  allTitles: string[] = [],
  env?: any,
): Promise<string | null> {
  const queries =
    buildSearchQueries(
      input,
      allTitles,
    );

  const cacheKey =
    `animeav1:${normalizeTitle(input)}`;

  const memory =
    memoryCache.get(
      cacheKey,
    );

  if (memory) {
    return memory;
  }

  if (env?.SLUG_CACHE) {
    try {
      const cached =
        await env.SLUG_CACHE.get(
          cacheKey,
        );

      if (cached) {
        memoryCache.set(
          cacheKey,
          cached,
        );

        return cached;
      }
    } catch {}
  }

  const candidates =
    new Map<
      string,
      SearchResult
    >();

  const primary =
    await Promise.all(
      queries
        .slice(0, 5)
        .map(query =>
          searchAnimeAV1(
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
          .slice(5, 9)
          .flatMap(query =>
            [1, 2].map(
              page =>
                searchAnimeAV1(
                  query,
                  page,
                ),
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
    cacheKey,
    best.slug,
  );

  if (env?.SLUG_CACHE) {
    try {
      await env.SLUG_CACHE.put(
        cacheKey,
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

function findScript(
  html: string,
): string | null {
  const scriptRegex =
    /<script\b[^>]*>([\s\S]*?)<\/script>/gi;

  let match:
    | RegExpExecArray
    | null;

  while (
    (match =
      scriptRegex.exec(html)) !== null
  ) {
    const script =
      match[1];

    if (
      script.includes(
        "kit.start(app, element, {",
      ) ||
      (
        script.includes(
          "embeds:",
        ) &&
        script.includes(
          "SUB:",
        )
      )
    ) {
      return script;
    }
  }

  return null;
}

function extractArray(
  text: string,
  marker: string,
): string | null {
  const markerIndex =
    text.indexOf(marker);

  if (markerIndex < 0) {
    return null;
  }

  const start =
    text.indexOf(
      "[",
      markerIndex +
        marker.length,
    );

  if (start < 0) {
    return null;
  }

  let depth = 0;
  let quote:
    | string
    | null = null;

  let escaped = false;

  for (
    let i = start;
    i < text.length;
    i++
  ) {
    const ch =
      text[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === "\\") {
        escaped = true;
        continue;
      }

      if (ch === quote) {
        quote = null;
      }

      continue;
    }

    if (
      ch === '"' ||
      ch === "'" ||
      ch === "`"
    ) {
      quote = ch;
      continue;
    }

    if (ch === "[") {
      depth++;
    } else if (ch === "]") {
      depth--;

      if (depth === 0) {
        return text.slice(
          start,
          i + 1,
        );
      }
    }
  }

  return null;
}

function parseEmbedArray(
  raw: string,
  language:
    | "sub"
    | "dub",
): AV1Embed[] {
  const result: AV1Embed[] = [];

  const objectRegex =
    /\{[\s\S]*?server\s*:\s*["']([^"']+)["'][\s\S]*?url\s*:\s*["']([^"']+)["'][\s\S]*?\}/gi;

  let match:
    | RegExpExecArray
    | null;

  while (
    (match =
      objectRegex.exec(raw)) !== null
  ) {
    const server =
      match[1].trim();

    const url =
      match[2]
        .replace(
          /\\(["'\\])/g,
          "$1",
        )
        .trim();

    if (!url) {
      continue;
    }

    result.push({
      server,
      url,
      language,
    });
  }

  return result;
}

export async function getAnimeAV1Embeds(
  slug: string,
  episode: number,
): Promise<AV1Embed[]> {
  const html =
    await fetchHtml(
      `${BASE}/media/${slug}/${episode}`,
    );

  if (!html) {
    return [];
  }

  const script =
    findScript(html);

  if (!script) {
    return [];
  }

  const subRaw =
    extractArray(
      script,
      "SUB:",
    );

  const dubRaw =
    extractArray(
      script,
      "DUB:",
    );

  const sub =
    subRaw
      ? parseEmbedArray(
          subRaw,
          "sub",
        )
      : [];

  const dub =
    dubRaw
      ? parseEmbedArray(
          dubRaw,
          "dub",
        )
      : [];

  return dedupeEmbeds([
    ...sub,
    ...dub,
  ]);
}

function dedupeEmbeds(
  embeds: AV1Embed[],
): AV1Embed[] {
  const seen =
    new Set<string>();

  return embeds.filter(
    embed => {
      const key =
        embed.url
          .split("?")[0];

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
}
