import { fetchHtml } from "./fetcher";
import {
  buildSearchQueries,
  normalizeTitle,
  rankCandidates,
  TitleCandidate,
} from "./titleMatcher";

const BASE = "https://animeav1.com";

const memoryCache = new Map<string, string>();

export interface AV1Embed {
  server: string;
  url: string;
  language: "sub" | "dub";
}

interface SearchResult extends TitleCandidate {
  url: string;
}

function cleanText(value: string): string {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeSearch(
  results: SearchResult[],
): SearchResult[] {
  const map = new Map<string, SearchResult>();

  for (const result of results) {
    if (!map.has(result.slug)) {
      map.set(result.slug, result);
    }
  }

  return [...map.values()];
}

function extractSearchResults(
  html: string,
): SearchResult[] {
  const results: SearchResult[] = [];

  const regex =
    /<a\b[^>]*href=["']\/media\/([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const slug = match[1].trim();
    const title = cleanText(match[2]);

    if (!slug || !title) {
      continue;
    }

    if (
      title.length < 2 ||
      title.length > 180
    ) {
      continue;
    }

    results.push({
      slug,
      title,
      url: `${BASE}/media/${slug}`,
    });
  }

  return dedupeSearch(results);
}

async function searchAnimeAV1(
  query: string,
): Promise<SearchResult[]> {
  const url =
    `${BASE}/catalogo?search=${encodeURIComponent(query)}`;

  const html = await fetchHtml(url);

  if (!html) {
    return [];
  }

  return extractSearchResults(html);
}

export async function findAnimeAV1Slug(
  input: string,
  allTitles: string[] = [],
  env?: any,
): Promise<string | null> {
  const key =
    `animeav1:${normalizeTitle(input)}`;

  const memory = memoryCache.get(key);

  if (memory) {
    return memory;
  }

  if (env?.SLUG_CACHE) {
    try {
      const cached =
        await env.SLUG_CACHE.get(key);

      if (cached) {
        memoryCache.set(key, cached);
        return cached;
      }
    } catch {}
  }

  const queries = buildSearchQueries(
    input,
    allTitles,
  );

  const candidates =
    new Map<string, SearchResult>();

  for (const query of queries.slice(0, 8)) {
    const results =
      await searchAnimeAV1(query);

    for (const result of results) {
      candidates.set(result.slug, result);
    }

    if (candidates.size >= 30) {
      break;
    }
  }

  const ranked = rankCandidates(
    [...candidates.values()],
    [input, ...allTitles],
  );

  if (!ranked.length) {
    return null;
  }

  const best = ranked[0];

  if (!best || best.score < 65) {
    return null;
  }

  memoryCache.set(key, best.slug);

  if (env?.SLUG_CACHE) {
    try {
      await env.SLUG_CACHE.put(
        key,
        best.slug,
        {
          expirationTtl: 60 * 60 * 24 * 7,
        },
      );
    } catch {}
  }

  return best.slug;
}

/*
 * Extrae:
 *
 * embeds:{
 *   SUB:[
 *      {server:"HLS",url:"..."},
 *      {server:"Voe",url:"..."},
 *      {server:"Byse",url:"..."},
 *      {server:"Mega",url:"..."},
 *      {server:"MP4Upload",url:"..."}
 *   ]
 * }
 *
 * Esto está dentro del árbol de datos
 * de SvelteKit.
 */
function extractSvelteEmbeds(
  html: string,
): AV1Embed[] {
  const results: AV1Embed[] = [];

  const marker = "embeds:";

  let searchFrom = 0;

  while (true) {
    const markerIndex =
      html.indexOf(marker, searchFrom);

    if (markerIndex < 0) {
      break;
    }

    const subIndex =
      html.indexOf(
        "SUB:",
        markerIndex,
      );

    if (
      subIndex < 0 ||
      subIndex > markerIndex + 300
    ) {
      searchFrom =
        markerIndex + marker.length;

      continue;
    }

    const arrayStart =
      html.indexOf(
        "[",
        subIndex,
      );

    if (arrayStart < 0) {
      break;
    }

    let depth = 0;
    let quote: string | null = null;
    let escaped = false;
    let arrayEnd = -1;

    for (
      let i = arrayStart;
      i < html.length;
      i++
    ) {
      const ch = html[i];

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

      if (ch === "[") {
        depth++;
      }

      if (ch === "]") {
        depth--;

        if (depth === 0) {
          arrayEnd = i;
          break;
        }
      }
    }

    if (arrayEnd < 0) {
      break;
    }

    const arrayText =
      html.slice(
        arrayStart,
        arrayEnd + 1,
      );

    /*
     * El objeto SvelteKit actual usa:
     *
     * {server:"HLS",url:"..."}
     */
    const objectRegex =
      /\{\s*server\s*:\s*["']([^"']+)["']\s*,\s*url\s*:\s*["']([^"']+)["']\s*\}/gi;

    let match: RegExpExecArray | null;

    while (
      (match =
        objectRegex.exec(
          arrayText,
        )) !== null
    ) {
      const server =
        match[1].trim();

      const url =
        match[2]
          .replace(
            /\\(["'\\])/g,
            "$1",
          )
          .replace(
            /\\u0026/gi,
            "&",
          )
          .trim();

      if (!url) {
        continue;
      }

      /*
       * NO queremos Voe.
       */
      if (
        server.toLowerCase() ===
        "voe"
      ) {
        continue;
      }

      /*
       * Solo estos cuatro.
       */
      if (
        ![
          "hls",
          "byse",
          "mega",
          "mp4upload",
        ].includes(
          server.toLowerCase(),
        )
      ) {
        continue;
      }

      results.push({
        server,
        url,
        language: "sub",
      });
    }

    if (results.length) {
      break;
    }

    searchFrom =
      arrayEnd + 1;
  }

  return dedupeEmbeds(results);
}

/*
 * Fallback para el HTML visible:
 *
 * data-src="BASE64"
 *
 * AnimeAV1 también tiene los mismos
 * servidores en esos botones.
 */
function extractButtonEmbeds(
  html: string,
): AV1Embed[] {
  const results: AV1Embed[] = [];

  const regex =
    /<button\b[^>]*class=["'][^"']*iframe_code[^"']*["'][^>]*data-src=["']([^"']+)["'][^>]*>([\s\S]*?)<\/button>/gi;

  let match: RegExpExecArray | null;

  while (
    (match = regex.exec(html)) !== null
  ) {
    const encoded = match[1];

    const label = cleanText(
      match[2],
    );

    if (
      label.toLowerCase() ===
      "voe"
    ) {
      continue;
    }

    try {
      const url =
        atob(encoded);

      if (
        !/^https?:\/\//i.test(url)
      ) {
        continue;
      }

      if (
        ![
          "hls",
          "byse",
          "mega",
          "mp4upload",
        ].includes(
          label.toLowerCase(),
        )
      ) {
        continue;
      }

      results.push({
        server: label,
        url,
        language: "sub",
      });
    } catch {}
  }

  return dedupeEmbeds(results);
}

function dedupeEmbeds(
  embeds: AV1Embed[],
): AV1Embed[] {
  const seen = new Set<string>();

  return embeds.filter(embed => {
    const key =
      embed.url
        .replace(/\/+$/, "")
        .toLowerCase();

    if (
      !key ||
      seen.has(key)
    ) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function getAnimeAV1Embeds(
  slug: string,
  episode: number,
): Promise<AV1Embed[]> {
  const url =
    `${BASE}/media/${slug}/${episode}`;

  const html =
    await fetchHtml(url);

  if (!html) {
    return [];
  }

  /*
   * PRIMERA OPCIÓN:
   * árbol de datos SvelteKit.
   */
  const fromSvelte =
    extractSvelteEmbeds(html);

  if (fromSvelte.length) {
    return fromSvelte;
  }

  /*
   * FALLBACK:
   * botones HTML.
   */
  return extractButtonEmbeds(
    html,
  );
}
