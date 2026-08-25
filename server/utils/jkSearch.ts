import { fetchHtml } from "./fetcher";
import { stripHtml } from "./htmlUtils";

import {
  buildSearchQueries,
  normalizeTitle,
  rankCandidates,
  TitleCandidate,
} from "./titleMatcher";

const memoryCache = new Map<string, string>();

interface JKSearchResult extends TitleCandidate {
  url: string;
}

/**
 * Rutas que claramente NO son animes.
 */
const INVALID_SLUGS = new Set([
  "buscar",
  "directorio",
  "genero",
  "generos",
  "horario",
  "login",
  "usuario",
  "ajax",
  "tipo",
  "ranking",
  "top",
  "historial",
  "guardado",
  "playlist",
  "aplicacion",
  "salir",
]);

function cleanTitle(value: string): string {
  return stripHtml(
    String(value || "")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&nbsp;/gi, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convierte un href de JKAnime en slug.
 */
function extractSlug(href: string): string | null {
  let value = String(href || "")
    .replace(/&amp;/gi, "&")
    .trim();

  if (!value) {
    return null;
  }

  try {
    if (/^https?:\/\//i.test(value)) {
      const parsed = new URL(value);

      if (
        !parsed.hostname
          .toLowerCase()
          .includes("jkanime.net")
      ) {
        return null;
      }

      value = parsed.pathname;
    }
  } catch {
    // Continuamos con extracción manual.
  }

  value = value
    .split("?")[0]
    .split("#")[0]
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (!value) {
    return null;
  }

  const parts = value
    .split("/")
    .filter(Boolean);

  if (!parts.length) {
    return null;
  }

  const slug = parts[parts.length - 1];

  if (
    !slug ||
    INVALID_SLUGS.has(slug.toLowerCase())
  ) {
    return null;
  }

  return slug;
}

/**
 * Extrae resultados de forma tolerante.
 *
 * NO dependemos de:
 *
 * <h2 class="portada-title">
 *
 * porque esa estructura puede cambiar.
 */
function extractResults(
  html: string,
): JKSearchResult[] {
  const results: JKSearchResult[] = [];

  /**
   * -------------------------------------------------------
   * MÉTODO 1
   * Enlaces de tarjetas / resultados.
   * -------------------------------------------------------
   */
  const anchorRegex =
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while (
    (match = anchorRegex.exec(html)) !== null
  ) {
    const attrs = match[1] || "";
    const body = match[2] || "";

    const hrefMatch =
      attrs.match(
        /\bhref\s*=\s*["']([^"']+)["']/i,
      );

    if (!hrefMatch) {
      continue;
    }

    const slug = extractSlug(
      hrefMatch[1],
    );

    if (!slug) {
      continue;
    }

    /**
     * Preferimos title="" si existe.
     */
    const titleAttr =
      attrs.match(
        /\btitle\s*=\s*["']([^"']+)["']/i,
      );

    let title = cleanTitle(
      titleAttr?.[1] ||
        body,
    );

    /**
     * Si el contenido es demasiado largo,
     * buscamos elementos típicos dentro del enlace.
     */
    if (
      title.length > 180
    ) {
      const innerTitle =
        body.match(
          /<(?:span|div|h[1-6])\b[^>]*>([\s\S]*?)<\/(?:span|div|h[1-6])>/i,
        );

      if (innerTitle) {
        title = cleanTitle(
          innerTitle[1],
        );
      }
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
      url:
        `https://jkanime.net/${slug}/`,
    });
  }

  /**
   * -------------------------------------------------------
   * MÉTODO 2
   * Si el HTML usa elementos específicos de tarjetas.
   * -------------------------------------------------------
   */
  const cardRegex =
    /<(?:article|div|li)\b[^>]*class=["'][^"']*(?:portada|anime|film|item|card|title)[^"']*["'][^>]*>([\s\S]*?)<\/(?:article|div|li)>/gi;

  while (
    (match = cardRegex.exec(html)) !== null
  ) {
    const block = match[1];

    const hrefMatch =
      block.match(
        /<a\b[^>]*href=["']([^"']+)["']/i,
      );

    if (!hrefMatch) {
      continue;
    }

    const slug =
      extractSlug(
        hrefMatch[1],
      );

    if (!slug) {
      continue;
    }

    const titleMatch =
      block.match(
        /(?:title|alt)=["']([^"']+)["']/i,
      );

    let title =
      titleMatch
        ? cleanTitle(
            titleMatch[1],
          )
        : cleanTitle(block);

    if (
      title.length > 180
    ) {
      title = title.slice(
        0,
        180,
      );
    }

    if (
      title.length < 2
    ) {
      continue;
    }

    results.push({
      slug,
      title,
      url:
        `https://jkanime.net/${slug}/`,
    });
  }

  /**
   * -------------------------------------------------------
   * DEDUPLICACIÓN
   * -------------------------------------------------------
   */
  const unique =
    new Map<
      string,
      JKSearchResult
    >();

  for (
    const result of results
  ) {
    const key =
      result.slug
        .toLowerCase();

    if (
      !unique.has(key)
    ) {
      unique.set(
        key,
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
  const cleanQuery =
    String(query || "")
      .trim();

  if (!cleanQuery) {
    return [];
  }

  const url =
    `https://jkanime.net/buscar/${encodeURIComponent(
      cleanQuery,
    )}/${page}/`;

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
  const cleanInput =
    String(input || "")
      .trim();

  if (!cleanInput) {
    return null;
  }

  const key =
    `jkanime:${normalizeTitle(
      cleanInput,
    )}`;

  /**
   * -------------------------------------------------------
   * MEMORY CACHE
   * -------------------------------------------------------
   */
  const memory =
    memoryCache.get(key);

  if (memory) {
    return memory;
  }

  /**
   * -------------------------------------------------------
   * KV CACHE
   * -------------------------------------------------------
   */
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
    } catch {
      // El scraper sigue funcionando aunque KV falle.
    }
  }

  /**
   * -------------------------------------------------------
   * CONSULTAS
   * -------------------------------------------------------
   */
  const queries =
    buildSearchQueries(
      cleanInput,
      allTitles,
    );

  if (!queries.length) {
    return null;
  }

  const candidates =
    new Map<
      string,
      JKSearchResult
    >();

  /**
   * Primero hacemos varias consultas en paralelo.
   */
  const primaryQueries =
    queries.slice(
      0,
      8,
    );

  const primary =
    await Promise.allSettled(
      primaryQueries.map(
        query =>
          searchJKAnime(
            query,
            1,
          ),
      ),
    );

  for (
    const item of primary
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

  /**
   * Si no encontramos nada,
   * hacemos consultas secundarias.
   */
  if (
    candidates.size === 0
  ) {
    const secondaryQueries =
      queries.slice(
        8,
        12,
      );

    const secondary =
      await Promise.allSettled(
        secondaryQueries.map(
          query =>
            searchJKAnime(
              query,
              1,
            ),
        ),
      );

    for (
      const item of secondary
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
  }

  if (
    candidates.size === 0
  ) {
    return null;
  }

  /**
   * -------------------------------------------------------
   * RANKING
   * -------------------------------------------------------
   */
  const ranked =
    rankCandidates(
      [
        ...candidates.values(),
      ],
      [
        cleanInput,
        ...allTitles,
      ],
    );

  if (!ranked.length) {
    return null;
  }

  const best =
    ranked[0];

  /**
   * Umbral deliberadamente más permisivo.
   *
   * El matcher ya considera:
   * - título
   * - slug
   * - tokens
   * - similitud
   * - temporada
   * - año
   */
  if (
    !best ||
    best.score < 65
  ) {
    return null;
  }

  /**
   * -------------------------------------------------------
   * CACHE
   * -------------------------------------------------------
   */
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
    } catch {
      // No bloquear por error de KV.
    }
  }

  return best.slug;
}
