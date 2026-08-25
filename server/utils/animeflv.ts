import { fetchHtml } from "./fetcher";

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
  language:
    | "sub"
    | "dub";
}

interface SearchResult
  extends TitleCandidate {
  url: string;
}

function cleanText(
  value: string,
): string {
  return String(value || "")
    .replace(
      /&amp;/gi,
      "&",
    )
    .replace(
      /&quot;/gi,
      '"',
    )
    .replace(
      /&#39;/gi,
      "'",
    )
    .replace(
      /&#x27;/gi,
      "'",
    )
    .replace(
      /<[^>]*>/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function normalizeEmbedUrl(
  value: string,
): string | null {
  let url =
    String(value || "")
      .replace(
        /\\(["'\\])/g,
        "$1",
      )
      .replace(
        /\\u0026/gi,
        "&",
      )
      .replace(
        /\\\//g,
        "/",
      )
      .replace(
        /&amp;/gi,
        "&",
      )
      .trim();

  if (
    url.startsWith("//")
  ) {
    url =
      `https:${url}`;
  }

  if (
    url.startsWith("/")
  ) {
    url =
      `${BASE}${url}`;
  }

  if (
    !/^https?:\/\//i.test(
      url,
    )
  ) {
    return null;
  }

  return url;
}

function dedupeSearch(
  results: SearchResult[],
): SearchResult[] {
  const map =
    new Map<
      string,
      SearchResult
    >();

  for (
    const result of results
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

function extractSearchResults(
  html: string,
): SearchResult[] {
  const results:
    SearchResult[] = [];

  /**
   * Ruta conocida:
   *
   * /media/slug
   */
  const regex =
    /<a\b[^>]*href=["']\/media\/([^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match:
    RegExpExecArray | null;

  while (
    (match =
      regex.exec(
        html,
      )) !== null
  ) {
    const slug =
      match[1]
        .trim();

    const title =
      cleanText(
        match[2],
      );

    if (
      !slug ||
      title.length < 2
    ) {
      continue;
    }

    results.push({
      slug,
      title,
      url:
        `${BASE}/media/${slug}`,
    });
  }

  /**
   * Fallback por cualquier href /media/.
   */
  const fallback =
    /href=["']([^"']*\/media\/([^"'?#]+))["']/gi;

  while (
    (match =
      fallback.exec(
        html,
      )) !== null
  ) {
    const slug =
      match[2]
        .trim();

    if (!slug) {
      continue;
    }

    const start =
      Math.max(
        0,
        match.index - 500,
      );

    const end =
      Math.min(
        html.length,
        match.index +
          match[0].length +
          500,
      );

    const context =
      html.slice(
        start,
        end,
      );

    const titleMatch =
      context.match(
        /(?:title|aria-label|alt)=["']([^"']+)["']/i,
      );

    const title =
      cleanText(
        titleMatch?.[1] ||
          slug.replace(
            /[-_]+/g,
            " ",
          ),
      );

    results.push({
      slug,
      title,
      url:
        `${BASE}/media/${slug}`,
    });
  }

  return dedupeSearch(
    results,
  );
}

async function searchAnimeAV1(
  query: string,
): Promise<SearchResult[]> {
  if (
    !query.trim()
  ) {
    return [];
  }

  const url =
    `${BASE}/catalogo?search=${encodeURIComponent(
      query,
    )}`;

  const html =
    await fetchHtml(url);

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
  const key =
    `animeav1:${normalizeTitle(
      input,
    )}`;

  const memory =
    memoryCache.get(
      key,
    );

  if (memory) {
    return memory;
  }

  if (
    env?.SLUG_CACHE
  ) {
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
      SearchResult
    >();

  /**
   * Las búsquedas se hacen en paralelo
   * para no ralentizar demasiado.
   */
  const results =
    await Promise.allSettled(
      queries
        .slice(0, 10)
        .map(
          query =>
            searchAnimeAV1(
              query,
            ),
        ),
    );

  for (
    const item of results
  ) {
    if (
      item.status !==
      "fulfilled"
    ) {
      continue;
    }

    for (
      const result of item.value
    ) {
      candidates.set(
        result.slug,
        result,
      );
    }
  }

  if (
    !candidates.size
  ) {
    return null;
  }

  const ranked =
    rankCandidates(
      [
        ...candidates.values(),
      ],
      [
        input,
        ...allTitles,
      ],
    );

  if (
    !ranked.length
  ) {
    return null;
  }

  const best =
    ranked[0];

  if (
    !best ||
    best.score < 60
  ) {
    return null;
  }

  memoryCache.set(
    key,
    best.slug,
  );

  if (
    env?.SLUG_CACHE
  ) {
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

/**
 * Extrae objetos:
 *
 * {
 *   server:"HLS",
 *   url:"..."
 * }
 */
function extractServerObjects(
  text: string,
): AV1Embed[] {
  const results:
    AV1Embed[] = [];

  const regex =
    /\{\s*server\s*:\s*["']([^"']+)["']\s*,\s*url\s*:\s*["']([^"']+)["'][^}]*\}/gi;

  let match:
    RegExpExecArray | null;

  while (
    (match =
      regex.exec(
        text,
      )) !== null
  ) {
    const server =
      cleanText(
        match[1],
      );

    const url =
      normalizeEmbedUrl(
        match[2],
      );

    if (
      !server ||
      !url
    ) {
      continue;
    }

    /**
     * No eliminamos Voe aquí.
     *
     * El agregador decide prioridades.
     */
    results.push({
      server,
      url,
      language: "sub",
    });
  }

  return results;
}

/**
 * JSON normal:
 *
 * {"server":"HLS","url":"..."}
 */
function extractJsonObjects(
  html: string,
): AV1Embed[] {
  const results:
    AV1Embed[] = [];

  const regex =
    /\{\s*["']server["']\s*:\s*["']([^"']+)["']\s*,\s*["']url["']\s*:\s*["']([^"']+)["'][^}]*\}/gi;

  let match:
    RegExpExecArray | null;

  while (
    (match =
      regex.exec(
        html,
      )) !== null
  ) {
    const server =
      cleanText(
        match[1],
      );

    const url =
      normalizeEmbedUrl(
        match[2],
      );

    if (
      !server ||
      !url
    ) {
      continue;
    }

    results.push({
      server,
      url,
      language: "sub",
    });
  }

  return results;
}

/**
 * Busca un array balanceado después de un marcador.
 */
function extractBalancedArray(
  text: string,
  marker: string,
): string | null {
  const markerIndex =
    text.indexOf(
      marker,
    );

  if (
    markerIndex < 0
  ) {
    return null;
  }

  const start =
    text.indexOf(
      "[",
      markerIndex +
        marker.length,
    );

  if (
    start < 0
  ) {
    return null;
  }

  let depth = 0;

  let quote:
    | string
    | null = null;

  let escaped =
    false;

  for (
    let i = start;
    i < text.length;
    i++
  ) {
    const ch =
      text[i];

    if (quote) {
      if (
        escaped
      ) {
        escaped =
          false;

        continue;
      }

      if (
        ch === "\\"
      ) {
        escaped =
          true;

        continue;
      }

      if (
        ch === quote
      ) {
        quote =
          null;
      }

      continue;
    }

    if (
      ch === '"' ||
      ch === "'" ||
      ch === "`"
    ) {
      quote =
        ch;

      continue;
    }

    if (
      ch === "["
    ) {
      depth++;
    }

    if (
      ch === "]"
    ) {
      depth--;

      if (
        depth === 0
      ) {
        return text.slice(
          start,
          i + 1,
        );
      }
    }
  }

  return null;
}

/**
 * Extrae embeds del árbol Svelte.
 */
function extractSvelteEmbeds(
  html: string,
): AV1Embed[] {
  const results:
    AV1Embed[] = [];

  const array =
    extractBalancedArray(
      html,
      "embeds:",
    );

  /**
   * Si no existe exactamente
   * embeds:, probamos embeds":
   */
  const fallbackArray =
    array ||
    extractBalancedArray(
      html,
      '"embeds"',
    );

  if (
    !fallbackArray
  ) {
    return [];
  }

  results.push(
    ...extractServerObjects(
      fallbackArray,
    ),
  );

  results.push(
    ...extractJsonObjects(
      fallbackArray,
    ),
  );

  return dedupeEmbeds(
    results,
  );
}

/**
 * Botones:
 *
 * class="iframe_code"
 * data-src="BASE64"
 */
function extractButtonEmbeds(
  html: string,
): AV1Embed[] {
  const results:
    AV1Embed[] = [];

  const regex =
    /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;

  let match:
    RegExpExecArray | null;

  while (
    (match =
      regex.exec(
        html,
      )) !== null
  ) {
    const attrs =
      match[1];

    const body =
      match[2];

    const dataSrc =
      attrs.match(
        /\bdata-src\s*=\s*["']([^"']+)["']/i,
      );

    if (!dataSrc) {
      continue;
    }

    let url:
      string | null =
      null;

    try {
      url =
        normalizeEmbedUrl(
          atob(
            dataSrc[1],
          ),
        );
    } catch {
      url =
        normalizeEmbedUrl(
          dataSrc[1],
        );
    }

    if (!url) {
      continue;
    }

    const label =
      cleanText(
        body,
      );

    const server =
      label ||
      "Externo";

    results.push({
      server,
      url,
      language: "sub",
    });
  }

  return dedupeEmbeds(
    results,
  );
}

function dedupeEmbeds(
  embeds: AV1Embed[],
): AV1Embed[] {
  const seen =
    new Set<string>();

  return embeds.filter(
    embed => {
      const url =
        normalizeEmbedUrl(
          embed.url,
        );

      if (!url) {
        return false;
      }

      const key =
        url
          .replace(
            /\/+$/,
            "",
          )
          .toLowerCase();

      if (
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);

      embed.url =
        url;

      return true;
    },
  );
}

/**
 * -------------------------------------------------------
 * SERVIDORES AV1
 * -------------------------------------------------------
 */
export async function getAnimeAV1Embeds(
  slug: string,
  episode: number,
): Promise<AV1Embed[]> {
  if (
    !slug ||
    !Number.isFinite(
      episode,
    )
  ) {
    return [];
  }

  const url =
    `${BASE}/media/${slug}/${episode}`;

  const html =
    await fetchHtml(url);

  if (!html) {
    return [];
  }

  const result:
    AV1Embed[] = [];

  /**
   * 1. SvelteKit.
   */
  result.push(
    ...extractSvelteEmbeds(
      html,
    ),
  );

  /**
   * 2. Objetos JS generales.
   */
  result.push(
    ...extractServerObjects(
      html,
    ),
  );

  /**
   * 3. JSON.
   */
  result.push(
    ...extractJsonObjects(
      html,
    ),
  );

  /**
   * 4. Botones HTML.
   */
  result.push(
    ...extractButtonEmbeds(
      html,
    ),
  );

  return dedupeEmbeds(
    result,
  );
}
