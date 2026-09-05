import { fetchHtml } from "./fetcher";
import { matchScore } from "./titleMatcher";

export interface AnimeYTServer {
  name: string;
  url: string;
  type: "embed";
}

/**
 * Decodifica entidades HTML comunes que pueden aparecer
 * dentro de atributos del HTML.
 */
function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

/**
 * Normaliza una URL para que sea utilizable por la API.
 */
function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  let url = decodeHtmlEntities(value)
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .trim();

  if (!url) {
    return null;
  }

  if (url.startsWith("//")) {
    url = `https:${url}`;
  }

  if (!/^https?:\/\//i.test(url)) {
    return null;
  }

  return url;
}

/**
 * Extrae atributos de un tag HTML concreto.
 */
function getAttribute(
  tag: string,
  attribute: string,
): string | null {
  const regex = new RegExp(
    `${attribute}\\s*=\\s*["']([\\s\\S]*?)["']`,
    "i",
  );

  const match = tag.match(regex);

  return match
    ? decodeHtmlEntities(match[1])
    : null;
}

/**
 * Busca iframes que apunten al reproductor intermedio
 * de Mytsumi.
 *
 * AnimeYT actualmente deja el iframe con:
 *
 * src="about:blank"
 * data-src="https://mytsumi.com/multiplayer/options.php..."
 *
 * Por eso primero buscamos data-src y luego src.
 */
function extractMytsumiPlayerUrls(
  html: string,
): string[] {
  const urls = new Set<string>();

  const iframeRegex =
    /<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi;

  const iframeTags =
    html.match(iframeRegex) || [];

  for (const tag of iframeTags) {
    const dataSrc =
      getAttribute(tag, "data-src");

    const src =
      getAttribute(tag, "src");

    const candidate =
      normalizeUrl(
        dataSrc || src,
      );

    if (!candidate) {
      continue;
    }

    if (
      !candidate.includes(
        "mytsumi.com/multiplayer/",
      )
    ) {
      continue;
    }

    if (
      !candidate.includes(
        "options.php",
      )
    ) {
      continue;
    }

    urls.add(candidate);
  }

  /*
   * Fallback por si el iframe está
   * serializado de una forma diferente.
   */
  const directRegex =
    /https?:\/\/mytsumi\.com\/multiplayer\/options\.php\?[^"'<>\\\s]+/gi;

  const directMatches =
    html.match(directRegex) || [];

  for (const raw of directMatches) {
    const candidate =
      normalizeUrl(raw);

    if (!candidate) {
      continue;
    }

    urls.add(candidate);
  }

  return [...urls];
}

/**
 * Extrae URLs de reproductores desde el HTML
 * de options.php.
 *
 * No dependemos de nombres concretos de servidores.
 * Buscamos las URLs reales dentro del documento.
 */
function extractPlayerUrls(
  html: string,
): string[] {
  const urls =
    new Set<string>();

  /*
   * 1. src="
   */
  const srcRegex =
    /\b(?:src|data-src|data-url|data-player|data-embed|data-iframe)\s*=\s*["']([^"']+)["']/gi;

  let match: RegExpExecArray | null;

  while (
    (match = srcRegex.exec(html)) !== null
  ) {
    const url =
      normalizeUrl(match[1]);

    if (!url) {
      continue;
    }

    urls.add(url);
  }

  /*
   * 2. href="
   *
   * Algunos selectores pueden usar enlaces
   * en lugar de iframe.
   */
  const hrefRegex =
    /\bhref\s*=\s*["']([^"']+)["']/gi;

  while (
    (match = hrefRegex.exec(html)) !== null
  ) {
    const url =
      normalizeUrl(match[1]);

    if (!url) {
      continue;
    }

    urls.add(url);
  }

  /*
   * 3. URL desnuda dentro del HTML / scripts.
   */
  const urlRegex =
    /https?:\/\/[^\s"'<>\\]+/gi;

  const rawUrls =
    html.match(urlRegex) || [];

  for (const rawUrl of rawUrls) {
    const url =
      normalizeUrl(rawUrl);

    if (!url) {
      continue;
    }

    urls.add(url);
  }

  return [
    ...urls,
  ];
}

/**
 * Descarta URLs que pertenezcan al propio
 * documento de opciones, imágenes, scripts,
 * estilos o recursos que no sean players.
 */
function isPossiblePlayer(
  url: string,
): boolean {
  const lower =
    url.toLowerCase();

  if (
    lower.includes(
      "mytsumi.com/multiplayer/options.php",
    )
  ) {
    return false;
  }

  if (
    lower.includes(
      "animeyt.cc/wp-content/",
    )
  ) {
    return false;
  }

  if (
    lower.endsWith(".js") ||
    lower.includes(".js?") ||
    lower.endsWith(".css") ||
    lower.includes(".css?")
  ) {
    return false;
  }

  if (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".svg")
  ) {
    return false;
  }

  if (
    lower.startsWith(
      "https://mytsumi.com/",
    ) &&
    (
      lower.includes("/multiplayer/options") ||
      lower.includes("/multiplayer/player")
    )
  ) {
    /*
     * Los documentos intermedios de Mytsumi
     * no son el player final.
     *
     * Pero NO descartamos otros subdominios
     * ni embeds externos.
     */
    return false;
  }

  return true;
}

/**
 * Intenta determinar un nombre útil según
 * el dominio del reproductor.
 *
 * El getServers.ts podrá renombrarlo después
 * si quiere mantener nombres genéricos.
 */
function detectServerName(
  url: string,
): string {
  const lower =
    url.toLowerCase();

  if (
    lower.includes(
      "player.zilla-networks.com",
    )
  ) {
    return "Zilla";
  }

  if (
    lower.includes(
      "mega.nz",
    )
  ) {
    return "Mega";
  }

  if (
    lower.includes(
      "mp4upload",
    )
  ) {
    return "MP4Upload";
  }

  if (
    lower.includes(
      "bysesuki",
    ) ||
    lower.includes(
      "byselapuix",
    ) ||
    lower.includes(
      "byse",
    )
  ) {
    return "Byse";
  }

  if (
    lower.includes(
      "mytsumi",
    )
  ) {
    return "Mytsumi";
  }

  if (
    lower.includes(
      "voe",
    )
  ) {
    return "Voe";
  }

  if (
    lower.includes(
      "vidhide",
    )
  ) {
    return "Vidhide";
  }

  if (
    lower.includes(
      "streamwish",
    )
  ) {
    return "Streamwish";
  }

  return "Servidor";
}

/**
 * Elimina duplicados conservando la URL completa.
 */
function dedupeServers(
  servers: AnimeYTServer[],
): AnimeYTServer[] {
  const seen =
    new Set<string>();

  const result:
    AnimeYTServer[] = [];

  for (const server of servers) {
    const url =
      normalizeUrl(server.url);

    if (!url) {
      continue;
    }

    const key =
      url.toLowerCase();

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    result.push({
      name:
        server.name ||
        detectServerName(url),
      url,
      type: "embed",
    });
  }

  return result;
}

/**
 * Algunas páginas tienen una única fuente visible
 * llamada Ultimate, pero el iframe intermedio puede
 * contener varios reproductores.
 *
 * Esta función intenta localizar servidores incluso
 * cuando el HTML usa JSON/JavaScript.
 */
function extractEmbeddedUrlsFromScripts(
  html: string,
): string[] {
  const urls =
    new Set<string>();

  /*
   * Busca strings con URLs dentro de:
   * JSON, JS, atributos, etc.
   */
  const patterns = [
    /["'](https?:\/\/[^"'\\\s]+)["']/gi,
    /\\?["'](https?:\/\/[^"'\\\s]+)\\?["']/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;

    while (
      (match = pattern.exec(html)) !== null
    ) {
      const url =
        normalizeUrl(match[1]);

      if (!url) {
        continue;
      }

      urls.add(url);
    }
  }

  return [
    ...urls,
  ];
}

/**
 * Normalización específica para búsqueda en AnimeYT.
 *
 * El sitio usa títulos humanos en /tv/{slug} y luego
 * añade "-capitulo-N" solamente a la URL del episodio.
 */
function normalizeSearchText(
  value: string,
): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\b(?:capitulo|capítulo|episodio|episode)\b/gi, " ")
    .replace(/\b(?:temporada|season)\s*(?:\d+|[ivxlcdm]+)\b/gi, " ")
    .replace(/\b(?:part|parte|cour)\s*(?:\d+|[ivxlcdm]+)\b/gi, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAnimeYTSlug(
  value: string,
): string {
  return normalizeSearchText(value)
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripHtml(
  value: string,
): string {
  return decodeHtmlEntities(
    String(value || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function extractAnchorLabel(
  anchor: string,
  slug: string,
): string {
  const aria =
    anchor.match(
      /\baria-label\s*=\s*["']([^"']+)["']/i,
    )?.[1];

  if (aria) {
    return stripHtml(aria);
  }

  const title =
    anchor.match(
      /\btitle\s*=\s*["']([^"']+)["']/i,
    )?.[1];

  if (title) {
    return stripHtml(title);
  }

  const alt =
    anchor.match(
      /\balt\s*=\s*["']([^"']+)["']/i,
    )?.[1];

  if (alt) {
    return stripHtml(alt);
  }

  const inner =
    anchor
      .replace(/^<a\b[^>]*>/i, "")
      .replace(/<\/a>\s*$/i, "");

  const text =
    stripHtml(inner);

  return (
    text ||
    slug.replace(/-/g, " ")
  );
}

function generateAnimeYTSearchQueries(
  query: string,
  allTitles: string[],
): string[] {
  const values = [
    query,
    ...allTitles,
  ];

  const queries =
    new Set<string>();

  const add = (
    value: string,
  ) => {
    const normalized =
      normalizeSearchText(value);

    if (!normalized) {
      return;
    }

    queries.add(normalized);
  };

  for (const value of values) {
    add(value);

    /*
     * También conservamos el título completo original
     * pero quitando solamente el marcador de episodio.
     */
    const withoutEpisode =
      String(value || "")
        .replace(
          /\b(?:capitulo|capítulo|episodio|episode)\s*[-_:]?\s*\d+\b/gi,
          "",
        )
        .replace(/\s+/g, " ")
        .trim();

    add(withoutEpisode);
  }

  /*
   * Búsquedas cortas como último recurso para nombres
   * excesivamente largos.
   */
  for (const value of values) {
    const words =
      normalizeSearchText(value)
        .split(" ")
        .filter(Boolean);

    if (words.length >= 3) {
      queries.add(
        words.slice(0, 3).join(" "),
      );
    }

    if (words.length >= 4) {
      queries.add(
        words.slice(0, 4).join(" "),
      );
    }
  }

  return [
    ...queries,
  ].slice(0, 12);
}

function extractAnimeYTSeriesCandidates(
  html: string,
): {
  slug: string;
  title: string;
}[] {
  const candidates: {
    slug: string;
    title: string;
  }[] = [];

  /*
   * Los enlaces reales de series aparecen como:
   *
   * https://animeyt.cc/tv/{slug}/
   */
  const regex =
    /<a\b[^>]*href\s*=\s*["'](https?:\/\/animeyt\.cc\/tv\/([^"'/?#]+)\/?)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi;

  let match:
    RegExpExecArray | null;

  while (
    (match = regex.exec(html)) !== null
  ) {
    const url =
      decodeHtmlEntities(
        match[1],
      );

    const slug =
      decodeHtmlEntities(
        match[2],
      );

    if (!slug) {
      continue;
    }

    /*
     * Recuperar el anchor completo para poder sacar
     * aria-label/title/alt o texto visible.
     */
    const start =
      match.index;

    const end =
      regex.lastIndex;

    const anchor =
      html.slice(
        start,
        end,
      );

    const title =
      extractAnchorLabel(
        anchor,
        slug,
      );

    candidates.push({
      slug,
      title,
    });
  }

  /*
   * Fallback más permisivo: encontrar simplemente
   * cualquier href /tv/...
   */
  const fallback =
    /href\s*=\s*["'](https?:\/\/animeyt\.cc\/tv\/([^"'/?#]+)\/?)["']/gi;

  while (
    (match = fallback.exec(html)) !== null
  ) {
    const slug =
      decodeHtmlEntities(
        match[2],
      );

    if (!slug) {
      continue;
    }

    candidates.push({
      slug,
      title:
        slug.replace(/-/g, " "),
    });
  }

  const unique =
    new Map<
      string,
      {
        slug: string;
        title: string;
      }
    >();

  for (const candidate of candidates) {
    const key =
      candidate.slug.toLowerCase();

    if (!unique.has(key)) {
      unique.set(
        key,
        candidate,
      );
    }
  }

  return [
    ...unique.values(),
  ];
}

/**
 * Resolver REAL de slug para AnimeYT.
 *
 * En lugar de convertir el slug de AniList a ciegas,
 * consulta resultados de AnimeYT, obtiene /tv/{slug}
 * y utiliza el mismo motor matchScore() del proyecto.
 */
export async function findAnimeYTSlug(
  query: string,
  allTitles: string[] = [],
  env?: any,
): Promise<string | null> {
  const queryKey =
    normalizeSearchText(query);

  if (!queryKey) {
    return null;
  }

  const cacheKey =
    `animeyt:${queryKey}`;

  /*
   * Cache en memoria del Worker.
   */
  const memoryCache =
    (findAnimeYTSlug as any).__cache ||
    ((findAnimeYTSlug as any).__cache =
      new Map<string, string>());

  if (
    memoryCache.has(cacheKey)
  ) {
    return memoryCache.get(
      cacheKey,
    ) || null;
  }

  /*
   * KV opcional, usando el mismo binding
   * que ya utiliza el resto del proyecto.
   */
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

  const queries =
    generateAnimeYTSearchQueries(
      query,
      [
        query,
        ...allTitles,
      ],
    );

  const candidates =
    new Map<
      string,
      {
        slug: string;
        title: string;
        score: number;
      }
    >();

  /*
   * Hacemos búsquedas independientes, porque AnimeYT
   * puede devolver distintos resultados dependiendo
   * de si se consulta por el título inglés, romaji,
   * título preferido, etc.
   */
  for (const searchQuery of queries) {
    const url =
      `https://animeyt.cc/?s=${encodeURIComponent(
        searchQuery,
      )}`;

    try {
      const html =
        await fetchHtml(url);

      if (!html) {
        continue;
      }

      const results =
        extractAnimeYTSeriesCandidates(
          html,
        );

      for (const result of results) {
        const score =
          matchScore(
            result.title,
            result.slug,
            null,
            [
              query,
              ...allTitles,
            ],
            null,
          );

        const previous =
          candidates.get(
            result.slug,
          );

        if (
          !previous ||
          score > previous.score
        ) {
          candidates.set(
            result.slug,
            {
              ...result,
              score,
            },
          );
        }
      }
    } catch (error) {
      console.log(
        `⚠️ AnimeYT search error "${searchQuery}":`,
        error,
      );
    }
  }

  if (!candidates.size) {
    return null;
  }

  const ranked =
    [
      ...candidates.values(),
    ].sort(
      (a, b) =>
        b.score - a.score,
    );

  const best =
    ranked[0];

  if (!best) {
    return null;
  }

  /*
   * 68 permite tolerar diferencias como:
   * - signos
   * - subtítulos
   * - traducciones
   * - pequeños cambios de slug
   *
   * pero no devuelve un resultado evidentemente
   * distinto.
   */
  if (best.score < 68) {
    console.log(
      `⚠️ AnimeYT: mejor candidato descartado (${best.score.toFixed(
        1,
      )}): ${best.title} -> ${best.slug}`,
    );

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

  console.log(
    `✅ AnimeYT slug resuelto: "${best.title}" -> "${best.slug}" (${best.score.toFixed(
      1,
    )})`,
  );

  return best.slug;
}

/**
 * Extrae el permalink real de un episodio desde
 * la página /tv/{slug}/.
 */
async function findEpisodeFromSeriesPage(
  slug: string,
  episode: number,
): Promise<string | null> {
  const seriesUrl =
    `https://animeyt.cc/tv/${slug}/`;

  try {
    const html =
      await fetchHtml(
        seriesUrl,
      );

    if (!html) {
      return null;
    }

    const target =
      String(
        episode,
      );

    /*
     * Ejemplo real:
     * /114561/anime/ryoumin-0-nin-start-no-henkyou-ryoushu-sama-capitulo-10/
     */
    const regex =
      /href\s*=\s*["'](https?:\/\/animeyt\.cc\/[^"'<>]*\/anime\/[^"'<>]*?)["']/gi;

    let match:
      RegExpExecArray | null;

    while (
      (match = regex.exec(html)) !== null
    ) {
      const candidate =
        decodeHtmlEntities(
          match[1],
        );

      const lower =
        candidate.toLowerCase();

      /*
       * Evitar que episodio 1 coincida con episodio 10, 11...
       */
      const episodeRegex =
        new RegExp(
          `-capitulo-${target}(?:\\/|\\?|#|$)`,
          "i",
        );

      if (
        episodeRegex.test(
          lower,
        )
      ) {
        return candidate;
      }
    }
  } catch (error) {
    console.log(
      `⚠️ AnimeYT series page error (${slug}):`,
      error,
    );
  }

  return null;
}

/**
 * Construye una URL de búsqueda de episodio.
 */
function buildEpisodeSearchUrls(
  slug: string,
  episode: number,
): string[] {
  const query =
    `${slug} capitulo ${episode}`;

  return [
    `https://animeyt.cc/?s=${encodeURIComponent(
      query,
    )}`,
    `https://animeyt.cc/?s=${encodeURIComponent(
      `${slug} ${episode}`,
    )}`,
  ];
}

/**
 * Construye la URL del episodio AnimeYT.
 *
 * AnimeYT utiliza:
 *
 * /{id}/anime/{slug}-capitulo-{episode}/
 *
 * Pero el ID numérico no lo necesitamos:
 * primero buscamos por slug y luego utilizamos
 * el permalink que devuelva la búsqueda.
 */
function buildDirectEpisodeUrl(
  slug: string,
  episode: number,
): string {
  return (
    `https://animeyt.cc/` +
    `anime/${slug}-capitulo-${episode}/`
  );
}

/**
 * Busca el permalink real del episodio
 * utilizando el buscador público de AnimeYT.
 *
 * Se mantienen varias estrategias porque algunas
 * páginas tienen el número de post delante del slug.
 */
async function findEpisodeUrl(
  slug: string,
  episode: number,
): Promise<string | null> {
  /*
   * PRIMERA ESTRATEGIA:
   * entrar a /tv/{slug}/ y obtener el permalink
   * real del episodio. Esto evita depender de que
   * el slug de episodio pueda reconstruirse a mano.
   */
  const fromSeries =
    await findEpisodeFromSeriesPage(
      slug,
      episode,
    );

  if (fromSeries) {
    return fromSeries;
  }

  /*
   * SEGUNDA ESTRATEGIA:
   * usar el buscador de AnimeYT.
   */
  const searchUrls =
    buildEpisodeSearchUrls(
      slug,
      episode,
    );

  for (const searchUrl of searchUrls) {
    try {
      const html =
        await fetchHtml(searchUrl);

      if (!html) {
        continue;
      }

      const hrefRegex =
        /href\s*=\s*["'](https?:\/\/animeyt\.cc\/[^"']*\/anime\/[^"']*capitulo-[^"']+)["']/gi;

      let match:
        RegExpExecArray | null;

      while (
        (match =
          hrefRegex.exec(
            html,
          )) !== null
      ) {
        const candidate =
          decodeHtmlEntities(
            match[1],
          );

        const lower =
          candidate.toLowerCase();

        const wanted =
          new RegExp(
            `-capitulo-${episode}(?:\\/|\\?|#|$)`,
            "i",
          );

        if (
          wanted.test(
            lower,
          )
        ) {
          return candidate;
        }
      }
    } catch (error) {
      console.log(
        `⚠️ AnimeYT episodio search error: ${searchUrl}`,
        error,
      );
    }
  }

  /*
   * No construimos aquí una URL ficticia como
   * /anime/{slug}-capitulo-{n}/ porque el formato
   * real incluye un prefijo numérico en los posts
   * publicados por AnimeYT.
   */
  return null;
}

/**
 * Scraper principal de AnimeYT.

 *
 * Flujo:
 *
 * slug
 *   ↓
 * episodio AnimeYT
 *   ↓
 * iframe data-src
 *   ↓
 * Mytsumi options.php
 *   ↓
 * HTML del selector
 *   ↓
 * URLs de players
 */
export async function getAnimeYTServers(
  slug: string,
  episode: number,
  allTitles: string[] = [],
  env?: any,
): Promise<AnimeYTServer[]> {
  if (
    !slug ||
    !Number.isFinite(
      Number(episode),
    )
  ) {
    console.log(
      "❌ AnimeYT: parámetros inválidos",
    );

    return [];
  }

  const normalizedSlug =
    slug
      .trim()
      .replace(
        /^\/+|\/+$/g,
        "",
      );

  const normalizedEpisode =
    Number(episode);

  let resolvedSlug =
    normalizedSlug;

  /*
   * Cuando el llamador nos entrega títulos de metadata,
   * resolver primero contra /tv/{slug}. Si no encontramos
   * coincidencia, conservamos el slug recibido como
   * fallback para no romper el comportamiento anterior.
   */
  if (
    allTitles.length ||
    normalizedSlug
  ) {
    try {
      const searchedSlug =
        await findAnimeYTSlug(
          normalizedSlug,
          allTitles,
          env,
        );

      if (searchedSlug) {
        resolvedSlug =
          searchedSlug;
      }
    } catch (error) {
      console.log(
        "⚠️ AnimeYT: error resolviendo slug; se conserva el recibido",
        error,
      );
    }
  }

  console.log(
    `🔍 AnimeYT: buscando "${resolvedSlug}" episodio ${normalizedEpisode}`,
  );

  /*
   * 1. Obtener URL real del episodio.
   */
  const episodeUrl =
    await findEpisodeUrl(
      resolvedSlug,
      normalizedEpisode,
    );

  if (!episodeUrl) {
    console.log(
      "❌ AnimeYT: no se encontró episodio",
    );

    return [];
  }

  console.log(
    `📄 AnimeYT episodio: ${episodeUrl}`,
  );

  /*
   * 2. Descargar HTML del episodio.
   */
  const episodeHtml =
    await fetchHtml(
      episodeUrl,
    );

  if (!episodeHtml) {
    console.log(
      "❌ AnimeYT: HTML de episodio vacío",
    );

    return [];
  }

  /*
   * 3. Buscar el iframe intermedio.
   */
  const mytsumiUrls =
    extractMytsumiPlayerUrls(
      episodeHtml,
    );

  if (!mytsumiUrls.length) {
    console.log(
      "❌ AnimeYT: no se encontró iframe Mytsumi",
    );

    return [];
  }

  console.log(
    `🎯 AnimeYT: ${mytsumiUrls.length} documento(s) Mytsumi encontrado(s)`,
  );

  const servers:
    AnimeYTServer[] = [];

  /*
   * 4. Abrir cada options.php.
   */
  for (
    const playerUrl of mytsumiUrls
  ) {
    try {
      console.log(
        `📡 AnimeYT → Mytsumi: ${playerUrl}`,
      );

      const playerHtml =
        await fetchHtml(
          playerUrl,
        );

      if (!playerHtml) {
        console.log(
          "⚠️ AnimeYT: Mytsumi devolvió HTML vacío",
        );

        continue;
      }

      /*
       * 5. Extraer URLs normales.
       */
      const directUrls =
        extractPlayerUrls(
          playerHtml,
        );

      /*
       * 6. Extraer URLs que puedan estar
       * dentro de scripts/JSON.
       */
      const scriptUrls =
        extractEmbeddedUrlsFromScripts(
          playerHtml,
        );

      const allUrls =
        new Set<string>([
          ...directUrls,
          ...scriptUrls,
        ]);

      for (const url of allUrls) {
        if (
          !isPossiblePlayer(url)
        ) {
          continue;
        }

        /*
         * Evitamos regresar el propio
         * documento de Mytsumi.
         */
        if (
          url === playerUrl
        ) {
          continue;
        }

        servers.push({
          name:
            detectServerName(url),
          url,
          type: "embed",
        });
      }
    } catch (error) {
      console.log(
        `⚠️ AnimeYT: error leyendo ${playerUrl}`,
        error,
      );
    }
  }

  /*
   * 7. Deduplicar.
   */
  const unique =
    dedupeServers(
      servers,
    );

  /*
   * 8. Orden recomendado.
   *
   * No elimina servidores.
   */
  const priority = (
    server: AnimeYTServer,
  ): number => {
    const name =
      server.name.toLowerCase();

    const url =
      server.url.toLowerCase();

    if (
      name.includes("zilla") ||
      url.includes(
        "player.zilla-networks.com",
      )
    ) {
      return 1;
    }

    if (
      name.includes("mytsumi")
    ) {
      return 2;
    }

    if (
      name.includes("mega") ||
      url.includes("mega.nz")
    ) {
      return 3;
    }

    if (
      name.includes(
        "mp4upload",
      ) ||
      url.includes(
        "mp4upload",
      )
    ) {
      return 4;
    }

    if (
      name.includes("byse")
    ) {
      return 5;
    }

    if (
      name.includes("vidhide")
    ) {
      return 6;
    }

    if (
      name.includes(
        "streamwish",
      )
    ) {
      return 7;
    }

    if (
      name.includes("voe")
    ) {
      return 8;
    }

    return 50;
  };

  unique.sort(
    (a, b) =>
      priority(a) -
      priority(b),
  );

  console.log(
    `✅ AnimeYT: ${unique.length} servidores encontrados`,
  );

  for (
    const server of unique
  ) {
    console.log(
      `   → ${server.name}: ${server.url}`,
    );
  }

  return unique;
}
