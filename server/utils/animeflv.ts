import { fetchHtml } from "./fetcher";

import {
  buildSearchQueries,
  normalizeTitle,
  rankCandidates,
  TitleCandidate,
} from "./titleMatcher";

const BASE_URL =
  "https://animeflv.or.at";

const memoryCache =
  new Map<string, string>();

export interface AnimeFLVServer {
  name: string;
  type: "Externo";
  embed: string;
}

interface AnimeFLVCandidate
  extends TitleCandidate {
  slug: string;
  url: string;
}

interface AnimeFLVEpisode {
  number: number;
  permalink: string;
  range?: string;
}

// ─────────────────────────────────────────────────────────────
// TEXT
// ─────────────────────────────────────────────────────────────

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
      /&nbsp;/gi,
      " ",
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

function decodeHtmlEntities(
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
      /&#x2F;/gi,
      "/",
    )
    .replace(
      /&#47;/gi,
      "/",
    )
    .replace(
      /&nbsp;/gi,
      " ",
    );
}

// ─────────────────────────────────────────────────────────────
// URL
// ─────────────────────────────────────────────────────────────

function normalizeUrl(
  value: string,
): string | null {
  let url =
    String(value || "")
      .trim()
      .replace(
        /\\u0026/gi,
        "&",
      )
      .replace(
        /\\\//g,
        "/",
      )
      .replace(
        /\\"/g,
        '"',
      );

  url =
    decodeHtmlEntities(
      url,
    );

  if (!url) {
    return null;
  }

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
      `${BASE_URL}${url}`;
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

// ─────────────────────────────────────────────────────────────
// BASE64
// ─────────────────────────────────────────────────────────────

function decodeBase64(
  value: string,
): string | null {
  try {
    const input =
      String(value || "")
        .trim()
        .replace(
          /\s+/g,
          "",
        );

    if (!input) {
      return null;
    }

    /*
     * AnimeFLV usa Base64 normal.
     */
    const decoded =
      atob(input);

    if (!decoded) {
      return null;
    }

    return decoded.trim();
  } catch {
    return null;
  }
}

function decodeServerValue(
  value: string,
): string | null {
  /*
   * Primero comprobamos si ya es
   * una URL directa.
   */
  const direct =
    normalizeUrl(value);

  if (direct) {
    return direct;
  }

  /*
   * Después Base64.
   */
  const decoded =
    decodeBase64(value);

  if (!decoded) {
    return null;
  }

  return normalizeUrl(
    decoded,
  );
}

// ─────────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────────

function extractSearchResults(
  html: string,
): AnimeFLVCandidate[] {
  const results:
    AnimeFLVCandidate[] =
    [];

  /*
   * Ruta principal:
   *
   * /anime/slug/
   */
  const regex =
    /<a\b[^>]*href=["']([^"']*\/anime\/([^/?#"']+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match:
    RegExpExecArray | null;

  while (
    (match =
      regex.exec(html)) !==
    null
  ) {
    const href =
      match[1];

    const slug =
      match[2];

    if (!slug) {
      continue;
    }

    const url =
      normalizeUrl(href);

    if (!url) {
      continue;
    }

    const title =
      cleanText(
        match[3],
      );

    results.push({
      slug,
      title:
        title.length >= 2
          ? title
          : slug.replace(
              /[-_]+/g,
              " ",
            ),
      url,
    });
  }

  /*
   * Fallback: cualquier /anime/
   */
  const fallback =
    /href=["']([^"']*\/anime\/([^/?#"']+)[^"']*)["']/gi;

  while (
    (match =
      fallback.exec(html)) !==
    null
  ) {
    const href =
      match[1];

    const slug =
      match[2];

    if (!slug) {
      continue;
    }

    const url =
      normalizeUrl(href);

    if (!url) {
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
      url,
    });
  }

  /*
   * Dedupe.
   */
  const unique =
    new Map<
      string,
      AnimeFLVCandidate
    >();

  for (
    const result of results
  ) {
    const key =
      result.slug.toLowerCase();

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

async function searchAnimeFLV(
  query: string,
): Promise<
  AnimeFLVCandidate[]
> {
  if (
    !query.trim()
  ) {
    return [];
  }

  /*
   * DOM real:
   *
   * https://animeflv.or.at/?s=query
   */
  const url =
    `${BASE_URL}/?s=${encodeURIComponent(
      query.trim(),
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

// ─────────────────────────────────────────────────────────────
// SLUG
// ─────────────────────────────────────────────────────────────

export async function findAnimeFLVSlug(
  input: string,
  allTitles: string[] = [],
  env?: any,
): Promise<string | null> {
  const key =
    `animeflv:${normalizeTitle(
      input,
    )}`;

  const memory =
    memoryCache.get(key);

  if (memory) {
    return memory;
  }

  /*
   * Cloudflare KV.
   */
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
      AnimeFLVCandidate
    >();

  const searches =
    await Promise.allSettled(
      queries
        .slice(0, 10)
        .map(query =>
          searchAnimeFLV(
            query,
          ),
        ),
    );

  for (
    const result of searches
  ) {
    if (
      result.status !==
      "fulfilled"
    ) {
      continue;
    }

    for (
      const candidate of
        result.value
    ) {
      candidates.set(
        candidate.slug,
        candidate,
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

  if (!best) {
    return null;
  }

  /*
   * No aceptamos coincidencias
   * demasiado diferentes.
   */
  if (
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

// ─────────────────────────────────────────────────────────────
// EPISODES JSON
// ─────────────────────────────────────────────────────────────

function extractEpisodes(
  html: string,
): AnimeFLVEpisode[] {
  const result:
    AnimeFLVEpisode[] =
    [];

  /*
   * EXACTAMENTE el nodo que
   * encontramos en la página:
   *
   * <script
   *   type="application/json"
   *   class="animeflv-episodes-data">
   */
  const scriptMatch =
    html.match(
      /<script\b[^>]*class=["'][^"']*animeflv-episodes-data[^"']*["'][^>]*>([\s\S]*?)<\/script>/i,
    );

  if (!scriptMatch) {
    return [];
  }

  let jsonText =
    scriptMatch[1]
      .trim()
      .replace(
        /^<!--/,
        "",
      )
      .replace(
        /-->$/,
        "",
      )
      .trim();

  if (!jsonText) {
    return [];
  }

  let data: any = null;

  try {
    data =
      JSON.parse(
        jsonText,
      );
  } catch {
    /*
     * Fallback para JSON escapado.
     */
    try {
      jsonText =
        jsonText
          .replace(
            /\\"/g,
            '"',
          )
          .replace(
            /\\\//g,
            "/",
          );

      data =
        JSON.parse(
          jsonText,
        );
    } catch {
      return [];
    }
  }

  if (
    !Array.isArray(data)
  ) {
    return [];
  }

  for (
    const item of data
  ) {
    if (
      !item ||
      typeof item !==
        "object"
    ) {
      continue;
    }

    const number =
      Number(
        item.number ??
          item.episode ??
          item.episodio,
      );

    const permalink =
      normalizeUrl(
        String(
          item.permalink ??
            item.url ??
            item.link ??
            "",
        ),
      );

    if (
      !Number.isFinite(
        number,
      ) ||
      !permalink
    ) {
      continue;
    }

    result.push({
      number,
      permalink,
      range:
        typeof item.range ===
        "string"
          ? item.range
          : undefined,
    });
  }

  /*
   * Deduplicar por número.
   */
  const unique =
    new Map<
      number,
      AnimeFLVEpisode
    >();

  for (
    const episode of result
  ) {
    unique.set(
      episode.number,
      episode,
    );
  }

  return [
    ...unique.values(),
  ].sort(
    (a, b) =>
      a.number - b.number,
  );
}

// ─────────────────────────────────────────────────────────────
// FIND EPISODE
// ─────────────────────────────────────────────────────────────

async function findEpisodeUrl(
  animeSlug: string,
  episodeNumber: number,
): Promise<string | null> {
  const animeUrl =
    `${BASE_URL}/anime/${animeSlug}/`;

  const html =
    await fetchHtml(
      animeUrl,
    );

  if (!html) {
    return null;
  }

  const episodes =
    extractEpisodes(
      html,
    );

  const episode =
    episodes.find(
      item =>
        item.number ===
        episodeNumber,
    );

  return (
    episode?.permalink ||
    null
  );
}

// ─────────────────────────────────────────────────────────────
// SERVER BUTTONS
// ─────────────────────────────────────────────────────────────

function extractServerButtons(
  html: string,
): AnimeFLVServer[] {
  const servers:
    AnimeFLVServer[] =
    [];

  /*
   * El árbol real es:
   *
   * div.server-frames
   *   └── button.iframe_code
   *         └── data-src="BASE64"
   */
  const buttonRegex =
    /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;

  let match:
    RegExpExecArray | null;

  while (
    (match =
      buttonRegex.exec(
        html,
      )) !== null
  ) {
    const attrs =
      match[1];

    const body =
      match[2];

    const classMatch =
      attrs.match(
        /\bclass\s*=\s*["']([^"']+)["']/i,
      );

    const className =
      classMatch?.[1] ||
      "";

    /*
     * Sólo botones de servidor.
     */
    if (
      !/iframe_code|iframe_btn|server_btn/i.test(
        className,
      )
    ) {
      continue;
    }

    const dataSrc =
      attrs.match(
        /\bdata-src\s*=\s*["']([^"']+)["']/i,
      );

    if (!dataSrc) {
      continue;
    }

    const embed =
      decodeServerValue(
        dataSrc[1],
      );

    if (!embed) {
      continue;
    }

    const label =
      cleanText(
        body,
      );

    servers.push({
      name:
        label ||
        detectProvider(
          embed,
        ),
      type: "Externo",
      embed,
    });
  }

  return dedupeServers(
    servers,
  );
}

// ─────────────────────────────────────────────────────────────
// DEFAULT SRC
// ─────────────────────────────────────────────────────────────

function extractDefaultServer(
  html: string,
): AnimeFLVServer | null {
  /*
   * Fallback:
   *
   * #iframeHolder
   * data-default-src="BASE64"
   */
  const match =
    html.match(
      /<[^>]*id=["']iframeHolder["'][^>]*data-default-src=["']([^"']+)["'][^>]*>/i,
    );

  if (!match) {
    return null;
  }

  const embed =
    decodeServerValue(
      match[1],
    );

  if (!embed) {
    return null;
  }

  return {
    name:
      detectProvider(
        embed,
      ),
    type: "Externo",
    embed,
  };
}

// ─────────────────────────────────────────────────────────────
// FALLBACK data-src
// ─────────────────────────────────────────────────────────────

function extractFallbackDataSrc(
  html: string,
): AnimeFLVServer[] {
  const servers:
    AnimeFLVServer[] =
    [];

  const regex =
    /<[^>]+\bdata-src=["']([^"']+)["'][^>]*>/gi;

  let match:
    RegExpExecArray | null;

  while (
    (match =
      regex.exec(html)) !==
    null
  ) {
    const embed =
      decodeServerValue(
        match[1],
      );

    if (!embed) {
      continue;
    }

    /*
     * Sólo consideramos URLs
     * que parecen players.
     */
    if (
      !/player|embed|m3u8|video|mega|mp4|byse|upn|voe/i.test(
        embed,
      )
    ) {
      continue;
    }

    servers.push({
      name:
        detectProvider(
          embed,
        ),
      type: "Externo",
      embed,
    });
  }

  return dedupeServers(
    servers,
  );
}

// ─────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────

function detectProvider(
  embed: string,
): string {
  const url =
    embed.toLowerCase();

  if (
    url.includes(
      "player.zilla-networks.com",
    )
  ) {
    return "Zilla";
  }

  if (
    url.includes(
      "upnshare",
    )
  ) {
    return "UPNShare";
  }

  if (
    url.includes(
      "voe",
    )
  ) {
    return "Voe";
  }

  if (
    url.includes(
      "byse",
    )
  ) {
    return "Byse";
  }

  if (
    url.includes(
      "mega.nz",
    )
  ) {
    return "Mega";
  }

  if (
    url.includes(
      "mp4upload",
    )
  ) {
    return "MP4Upload";
  }

  if (
    url.includes(
      "mytsumi",
    )
  ) {
    return "Mytsumi";
  }

  return "Externo";
}

// ─────────────────────────────────────────────────────────────
// DEDUPE
// ─────────────────────────────────────────────────────────────

function dedupeServers(
  servers: AnimeFLVServer[],
): AnimeFLVServer[] {
  const seen =
    new Set<string>();

  const result:
    AnimeFLVServer[] =
    [];

  for (
    const server of servers
  ) {
    if (
      !server?.embed
    ) {
      continue;
    }

    const normalized =
      normalizeUrl(
        server.embed,
      );

    if (!normalized) {
      continue;
    }

    const key =
      normalized
        .toLowerCase()
        .replace(
          /\/+$/,
          "",
        );

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    result.push({
      name:
        detectProvider(
          normalized,
        ),
      type: "Externo",
      embed:
        normalized,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

export async function getAnimeFLVServers(
  slug: string,
  episodeNumber: number,
  allTitles: string[] = [],
  env?: any,
): Promise<AnimeFLVServer[]> {
  if (
    !slug ||
    !Number.isFinite(
      Number(episodeNumber),
    )
  ) {
    return [];
  }

  const episode =
    Number(
      episodeNumber,
    );

  /*
   * 1.
   *
   * Resolver el permalink real
   * mediante animeflv-episodes-data.
   */
  const episodeUrl =
    await findEpisodeUrl(
      slug,
      episode,
    );

  if (!episodeUrl) {
    return [];
  }

  console.log(
    `🎬 AnimeFLV episodio ${episode}: ${episodeUrl}`,
  );

  /*
   * 2.
   *
   * Entrar directamente a la
   * página del capítulo.
   */
  const html =
    await fetchHtml(
      episodeUrl,
    );

  if (!html) {
    return [];
  }

  /*
   * 3.
   *
   * Extraer los botones:
   *
   * .iframe_code[data-src]
   */
  let servers =
    extractServerButtons(
      html,
    );

  /*
   * 4. Fallback data-src.
   */
  if (
    !servers.length
  ) {
    servers =
      extractFallbackDataSrc(
        html,
      );
  }

  /*
   * 5. Fallback iframeHolder.
   */
  if (
    !servers.length
  ) {
    const fallback =
      extractDefaultServer(
        html,
      );

    if (fallback) {
      servers.push(
        fallback,
      );
    }
  }

  /*
   * 6. Dedupe.
   */
  servers =
    dedupeServers(
      servers,
    );

  /*
   * 7.
   *
   * Ordenamos poniendo Zilla
   * primero.
   */
  servers.sort(
    (a, b) =>
      providerPriority(a) -
      providerPriority(b),
  );

  /*
   * 8.
   *
   * Voe queda fuera.
   */
  servers =
    servers.filter(
      server =>
        server.name
          .toLowerCase() !==
        "voe",
    );

  /*
   * 9.
   *
   * El contrato final del proyecto.
   */
  return servers.map(
    server => ({
      name:
        server.name,
      type: "Externo",
      embed:
        server.embed,
    }),
  );
}

// ─────────────────────────────────────────────────────────────
// PRIORITY
// ─────────────────────────────────────────────────────────────

function providerPriority(
  server: AnimeFLVServer,
): number {
  const url =
    server.embed.toLowerCase();

  if (
    url.includes(
      "player.zilla-networks.com",
    )
  ) {
    return 1;
  }

  if (
    server.name
      .toLowerCase()
      .includes("hls")
  ) {
    return 2;
  }

  if (
    url.includes(
      "upnshare",
    )
  ) {
    return 3;
  }

  if (
    url.includes(
      "byse",
    )
  ) {
    return 4;
  }

  if (
    url.includes(
      "mega.nz",
    )
  ) {
    return 5;
  }

  if (
    url.includes(
      "mp4upload",
    )
  ) {
    return 6;
  }

  return 50;
}

// ─────────────────────────────────────────────────────────────
// COMPATIBILITY ALIAS
// ─────────────────────────────────────────────────────────────

export async function getAnimeFLVEmbeds(
  slug: string,
  episodeNumber: number,
  allTitles: string[] = [],
  env?: any,
): Promise<AnimeFLVServer[]> {
  return getAnimeFLVServers(
    slug,
    episodeNumber,
    allTitles,
    env,
  );
}
