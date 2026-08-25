import { fetchHtml } from "./fetcher";
import { stripHtml } from "./htmlUtils";
import {
  buildSearchQueries,
  normalizeTitle,
  rankCandidates,
  TitleCandidate,
} from "./titleMatcher";

const BASE =
  "https://www4.animeflv.net";

const memoryCache =
  new Map<string, string>();

export interface AnimeFLVServer {
  name: string;
  url: string;
  type:
    | "iframe"
    | "mp4"
    | "generic";
}

interface SearchResult
  extends TitleCandidate {
  url: string;
}

function extractSearchResults(
  html: string,
): SearchResult[] {
  const results: SearchResult[] = [];

  const itemRegex =
    /<li\b[^>]*>([\s\S]*?)<\/li>/gi;

  let match:
    | RegExpExecArray
    | null;

  while (
    (match =
      itemRegex.exec(html)) !== null
  ) {
    const block = match[1];

    const hrefMatch =
      block.match(
        /href=["']\/anime\/([^"']+)["']/i,
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
      stripHtml(titleMatch[1]);

    if (!slug || !title) {
      continue;
    }

    results.push({
      slug,
      title,
      url: `${BASE}/anime/${slug}`,
    });
  }

  if (results.length) {
    return dedupe(results);
  }

  // Fallback para cambios menores del HTML.
  const linkRegex =
    /<a\b[^>]*href=["']\/anime\/([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  while (
    (match =
      linkRegex.exec(html)) !== null
  ) {
    const slug =
      match[1].trim();

    const titleMatch =
      match[2].match(
        /<h3\b[^>]*>([\s\S]*?)<\/h3>/i,
      );

    const title = stripHtml(
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
        url: `${BASE}/anime/${slug}`,
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

  for (const result of results) {
    if (!map.has(result.slug)) {
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

export async function searchAnimeFLV(
  query: string,
  page = 1,
): Promise<SearchResult[]> {
  const url =
    `${BASE}/browse?q=${encodeURIComponent(query)}` +
    (page > 1
      ? `&page=${page}`
      : "");

  const html =
    await fetchHtml(url);

  if (!html) {
    return [];
  }

  return extractSearchResults(
    html,
  );
}

export async function findAnimeFLVSlug(
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
    `animeflv:${normalizeTitle(input)}`;

  const memory =
    memoryCache.get(cacheKey);

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

  // Primera pasada rápida.
  const primary =
    await Promise.all(
      queries
        .slice(0, 5)
        .map(query =>
          searchAnimeFLV(
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

  // Segunda pasada solamente si no hay coincidencia clara.
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
                searchAnimeFLV(
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

function normalizeServerUrl(
  url: string,
): string {
  if (!url) return "";

  return url
    .replace(
      "mega.nz/embed#!",
      "mega.nz/embed/",
    )
    .replace(
      "mega.nz/#!",
      "mega.nz/file/",
    )
    .trim();
}

function extractVideosObject(
  html: string,
): any | null {
  const marker =
    "var videos =";

  const index =
    html.indexOf(marker);

  if (index < 0) {
    return null;
  }

  const start =
    html.indexOf(
      "{",
      index + marker.length,
    );

  if (start < 0) {
    return null;
  }

  let depth = 0;
  let quote:
    | string
    | null = null;

  let escaped = false;
  let end = -1;

  for (
    let i = start;
    i < html.length;
    i++
  ) {
    const ch =
      html[i];

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
      ch === "'"
    ) {
      quote = ch;
      continue;
    }

    if (ch === "{") {
      depth++;
    }

    if (ch === "}") {
      depth--;

      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end < 0) {
    return null;
  }

  const raw =
    html.slice(
      start,
      end,
    );

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getAnimeFLVServers(
  slug: string,
  episode: number,
): Promise<AnimeFLVServer[]> {
  const url =
    `${BASE}/ver/${slug}-${episode}`;

  const html =
    await fetchHtml(url);

  if (!html) {
    return [];
  }

  const videos =
    extractVideosObject(
      html,
    );

  const sub =
    Array.isArray(
      videos?.SUB,
    )
      ? videos.SUB
      : [];

  const dub =
    Array.isArray(
      videos?.DUB,
    )
      ? videos.DUB
      : [];

  const sourceList =
    sub.length
      ? sub
      : dub;

  return sourceList
    .map((server: any) => {
      const raw =
        normalizeServerUrl(
          server?.code ||
          server?.url ||
          "",
        );

      if (!raw) {
        return null;
      }

      return {
        name: String(
          server?.title ||
            "AnimeFLV",
        ),

        url: raw,

        type: raw.includes(
          ".mp4",
        )
          ? "mp4"
          : "iframe",
      } as AnimeFLVServer;
    })
    .filter(Boolean) as AnimeFLVServer[];
}
