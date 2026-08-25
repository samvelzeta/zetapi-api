import { fetchHtml, getHeaders } from "./fetcher";
import { getAnimeMetadata } from "./metadata";

export interface AnimeD23Server {
  name: string;
  url: string;
  type: "iframe" | "mp4";
}

const HOSTS = [
  "https://animed23.com",
  "https://animed23.online",
];

const PROVIDERS: Array<{
  name: string;
  pattern: RegExp;
}> = [
  {
    name: "Moon",
    pattern: /bysesukior\.com/i,
  },
  {
    name: "Mytsumi",
    pattern: /mytsumi\.com/i,
  },
  {
    name: "Mega",
    pattern: /mega\.nz/i,
  },
  {
    name: "Archive",
    pattern: /archive\.org/i,
  },
  {
    name: "OK",
    pattern: /(?:^|[./])ok\.ru/i,
  },
  {
    name: "Epsilon",
    pattern: /ytplay/i,
  },
  {
    name: "Abyss",
    pattern: /abyssplayer/i,
  },
  {
    name: "MP4Upload",
    pattern: /mp4upload\.com/i,
  },
  {
    name: "Zilla",
    pattern: /zilla-networks\.com/i,
  },
  {
    name: "Tera",
    pattern: /(?:terabox|1024terabox)\.com/i,
  },
  {
    name: "MediaFire",
    pattern: /mediafire\.com/i,
  },
  {
    name: "GoFile",
    pattern: /gofile\.io/i,
  },
  {
    name: "FireLoad",
    pattern: /fireload\.com/i,
  },
];

/* ============================================================
 * NORMALIZACIÓN
 * ========================================================== */

function normalizeSource(
  value: string,
): string {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/gi, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u002f/gi, "/")
    .replace(/\\u002F/gi, "/")
    .replace(/\\u003a/gi, ":")
    .replace(/\\u003A/gi, ":")
    .replace(/\\\//g, "/")
    .trim();
}

function normalizeUrl(
  value: string,
): string {
  let url = normalizeSource(value)
    .replace(/[\r\n\t]/g, "")
    .replace(/[)\]}>]+$/g, "")
    .trim();

  /*
   * IMPORTANTE:
   *
   * NO hacemos:
   *
   * url.replace(/\/{2,}/g, "/")
   *
   * porque eso puede destruir https://.
   */

  url = url.replace(
    /^(https?:\/\/[^/]+)\/+/i,
    "$1/",
  );

  return url;
}

/* ============================================================
 * SLUGS
 * ========================================================== */

function slugify(
  value: string,
): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateTitleVariants(
  value: string,
): string[] {
  const base = slugify(value);

  if (!base) {
    return [];
  }

  const variants =
    new Set<string>();

  const add = (
    candidate: string,
  ) => {
    const clean =
      candidate
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    if (clean) {
      variants.add(clean);
    }
  };

  add(base);

  /*
   * Temporadas.
   *
   * Ejemplo:
   *
   * tensei-shitara-slime-datta-ken-temporada-4
   */

  const season =
    base.match(
      /^(.*?)-(?:temporada|season|t)-?(\d+)$/i,
    );

  if (season) {
    const title = season[1];
    const number = season[2];

    add(title);
    add(`${title}-${number}`);
    add(`${title}-temporada-${number}`);
    add(`${title}-season-${number}`);
    add(`${title}-${number}-season`);
    add(`${title}-${number}th-season`);
  }

  /*
   * AnimeD23 utiliza también años:
   *
   * boku-no-kokoro-no-yabai-yatsu-movie-2026
   */

  add(
    base.replace(
      /-(?:19|20)\d{2}$/,
      "",
    ),
  );

  return [
    ...variants,
  ].slice(0, 50);
}

/* ============================================================
 * NOMBRE DEL PROVIDER
 * ========================================================== */

function providerName(
  url: string,
  explicitName?: string,
): string {
  if (explicitName) {
    return explicitName;
  }

  for (const provider of PROVIDERS) {
    if (provider.pattern.test(url)) {
      return provider.name;
    }
  }

  return "AnimeD23";
}

function serverType(
  url: string,
): "iframe" | "mp4" {
  return /\.(?:mp4|m3u8)(?:$|[?#])/i.test(
    url,
  )
    ? "mp4"
    : "iframe";
}

/* ============================================================
 * DEDUPLICAR
 * ========================================================== */

function dedupeServers(
  servers: AnimeD23Server[],
): AnimeD23Server[] {
  const seen =
    new Set<string>();

  const result: AnimeD23Server[] = [];

  for (const server of servers) {
    const url =
      normalizeUrl(
        server.url,
      );

    if (
      !/^https?:\/\//i.test(url)
    ) {
      continue;
    }

    const key =
      url.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    result.push({
      name:
        providerName(
          url,
          server.name,
        ),
      url,
      type:
        serverType(url),
    });
  }

  return result;
}

/* ============================================================
 * FETCH
 * ========================================================== */

async function fetchPage(
  url: string,
  referer?: string,
): Promise<string | null> {
  try {
    const headers: Record<
      string,
      string
    > = {
      ...getHeaders(url),
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };

    if (referer) {
      headers.Referer =
        referer;
    }

    const response =
      await fetch(url, {
        method: "GET",
        headers,
        redirect: "follow",
      });

    if (!response.ok) {
      console.log(
        "⚠️ AnimeD23 HTTP:",
        response.status,
        url,
      );

      return null;
    }

    const text =
      await response.text();

    if (
      !text ||
      text.length < 100
    ) {
      return null;
    }

    return text;
  } catch (error) {
    console.log(
      "⚠️ AnimeD23 FETCH:",
      url,
      error,
    );

    return null;
  }
}

/* ============================================================
 * EXTRACTOR DE ARRAY JAVASCRIPT
 *
 * Busca:
 *
 * const videoTabs = [...]
 *
 * sin depender de regex frágiles.
 * ========================================================== */

function extractBalancedArray(
  source: string,
  marker: string,
): string | null {
  const markerIndex =
    source.indexOf(
      marker,
    );

  if (
    markerIndex < 0
  ) {
    return null;
  }

  const start =
    source.indexOf(
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
  let quote = "";
  let escaped = false;

  for (
    let i = start;
    i < source.length;
    i++
  ) {
    const char =
      source[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (
        char === "\\"
      ) {
        escaped = true;
      } else if (
        char === quote
      ) {
        quote = "";
      }

      continue;
    }

    if (
      char === '"' ||
      char === "'"
    ) {
      quote = char;
      continue;
    }

    if (
      char === "["
    ) {
      depth++;
    }

    if (
      char === "]"
    ) {
      depth--;

      if (depth === 0) {
        return source.slice(
          start,
          i + 1,
        );
      }
    }
  }

  return null;
}

/* ============================================================
 * EXTRACTOR DE OBJECT
 *
 * Busca:
 *
 * const downloadsByQuality = {...}
 * ========================================================== */

function extractBalancedObject(
  source: string,
  marker: string,
): string | null {
  const markerIndex =
    source.indexOf(
      marker,
    );

  if (
    markerIndex < 0
  ) {
    return null;
  }

  const start =
    source.indexOf(
      "{",
      markerIndex +
        marker.length,
    );

  if (
    start < 0
  ) {
    return null;
  }

  let depth = 0;
  let quote = "";
  let escaped = false;

  for (
    let i = start;
    i < source.length;
    i++
  ) {
    const char =
      source[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (
        char === "\\"
      ) {
        escaped = true;
      } else if (
        char === quote
      ) {
        quote = "";
      }

      continue;
    }

    if (
      char === '"' ||
      char === "'"
    ) {
      quote = char;
      continue;
    }

    if (
      char === "{"
    ) {
      depth++;
    }

    if (
      char === "}"
    ) {
      depth--;

      if (depth === 0) {
        return source.slice(
          start,
          i + 1,
        );
      }
    }
  }

  return null;
}

/* ============================================================
 * VIDEO TABS
 *
 * ESTA ES LA PARTE CLAVE.
 *
 * AnimeD23 realmente entrega:
 *
 * const videoTabs = [
 *   {
 *      tab_name: "Moon",
 *      url: "..."
 *   },
 *   ...
 * ];
 * ========================================================== */

function extractVideoTabs(
  html: string,
): AnimeD23Server[] {
  const source =
    normalizeSource(
      html,
    );

  const arrayText =
    extractBalancedArray(
      source,
      "const videoTabs",
    );

  if (!arrayText) {
    console.log(
      "⚠️ AnimeD23: videoTabs no encontrado",
    );

    return [];
  }

  try {
    const tabs =
      JSON.parse(
        arrayText,
      ) as Array<{
        tab_name?: string;
        url?: string;
        status?: string;
      }>;

    if (
      !Array.isArray(tabs)
    ) {
      return [];
    }

    const servers =
      tabs
        .filter(
          tab =>
            tab &&
            tab.status !==
              "inactive",
        )
        .map(
          tab => {
            const url =
              normalizeUrl(
                tab.url ||
                  "",
              );

            return {
              name:
                providerName(
                  url,
                  tab.tab_name,
                ),
              url,
              type:
                serverType(
                  url,
                ),
            };
          },
        )
        .filter(
          server =>
            /^https?:\/\//i.test(
              server.url,
            ),
        );

    console.log(
      "🎥 AnimeD23 videoTabs:",
      servers,
    );

    return servers;
  } catch (error) {
    console.log(
      "❌ AnimeD23 videoTabs JSON:",
      error,
    );

    return [];
  }
}

/* ============================================================
 * DOWNLOADS
 *
 * También existen en:
 *
 * const downloadsByQuality = {...}
 * ========================================================== */

function extractDownloads(
  html: string,
): AnimeD23Server[] {
  const source =
    normalizeSource(
      html,
    );

  const objectText =
    extractBalancedObject(
      source,
      "const downloadsByQuality",
    );

  if (!objectText) {
    return [];
  }

  try {
    const downloads =
      JSON.parse(
        objectText,
      ) as Record<
        string,
        Array<{
          download_url?: string;
          server_name?: string;
        }>
      >;

    const result:
      AnimeD23Server[] = [];

    for (
      const quality of
        Object.keys(
          downloads,
        )
    ) {
      for (
        const item of
          downloads[
            quality
          ] || []
      ) {
        const url =
          normalizeUrl(
            item.download_url ||
              "",
          );

        if (
          !/^https?:\/\//i.test(
            url,
          )
        ) {
          continue;
        }

        result.push({
          name:
            providerName(
              url,
              item.server_name,
            ),
          url,
          type:
            serverType(url),
        });
      }
    }

    return result;
  } catch (error) {
    console.log(
      "⚠️ AnimeD23 downloads:",
      error,
    );

    return [];
  }
}

/* ============================================================
 * ARCHIVE.ORG DENTRO DE MYTSUMI
 *
 * Este es el segundo nivel que faltaba.
 *
 * Mytsumi:
 *
 * iframe
 *   ↓
 * HTML
 *   ↓
 * <video src="https://archive.org/...mp4">
 * ========================================================== */

function extractArchiveUrls(
  html: string,
): AnimeD23Server[] {
  const source =
    normalizeSource(
      html,
    );

  const result:
    AnimeD23Server[] = [];

  const seen =
    new Set<string>();

  const add = (
    rawUrl: string,
  ) => {
    const url =
      normalizeUrl(
        rawUrl,
      );

    if (
      !/archive\.org\//i.test(
        url,
      )
    ) {
      return;
    }

    if (
      !/^https?:\/\//i.test(
        url,
      )
    ) {
      return;
    }

    if (
      seen.has(url)
    ) {
      return;
    }

    seen.add(url);

    result.push({
      name: "Archive",
      url,
      type: "mp4",
    });
  };

  /*
   * <video src="">
   */

  const videoRegex =
    /<video\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;

  for (
    const match of
      source.matchAll(
        videoRegex,
      )
  ) {
    add(match[1]);
  }

  /*
   * <source src="">
   */

  const sourceRegex =
    /<source\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;

  for (
    const match of
      source.matchAll(
        sourceRegex,
      )
  ) {
    add(match[1]);
  }

  /*
   * Archive aunque esté en JS.
   */

  const archiveRegex =
    /https?:\/\/[^"'<>\\\s]*archive\.org\/[^"'<>\\\s]+/gi;

  for (
    const match of
      source.matchAll(
        archiveRegex,
      )
  ) {
    add(match[0]);
  }

  console.log(
    "📦 AnimeD23 Archive:",
    result,
  );

  return result;
}

/* ============================================================
 * MYTSUMI
 * ========================================================== */

async function extractMytsumiArchive(
  server: AnimeD23Server,
  referer: string,
): Promise<AnimeD23Server[]> {
  if (
    !/mytsumi\.com/i.test(
      server.url,
    )
  ) {
    return [];
  }

  console.log(
    "🔍 AnimeD23 entrando a Mytsumi:",
    server.url,
  );

  const html =
    await fetchPage(
      server.url,
      referer,
    );

  if (!html) {
    console.log(
      "⚠️ AnimeD23 Mytsumi no respondió",
    );

    return [];
  }

  return extractArchiveUrls(
    html,
  );
}

/* ============================================================
 * OPTIONS.PHP
 *
 * IMPORTANTE:
 *
 * options.php NO es el lugar donde debemos asumir que vienen
 * directamente las URLs.
 *
 * En el HTML real que proporcionaste, ese endpoint termina
 * entregando el HTML que contiene videoTabs.
 * ========================================================== */

function extractOptionsUrl(
  html: string,
): string | null {
  const source =
    normalizeSource(
      html,
    );

  const patterns = [
    /https?:\/\/animed23\.(?:com|online)\/opciones\/options\.php\?server=multi&value=[^"'<>\\\s]+/gi,

    /\/opciones\/options\.php\?server=multi&value=[^"'<>\\\s]+/gi,
  ];

  for (
    const pattern of
      patterns
  ) {
    const match =
      source.match(
        pattern,
      );

    if (
      !match?.[0]
    ) {
      continue;
    }

    let url =
      normalizeUrl(
        match[0],
      );

    if (
      url.startsWith(
        "/",
      )
    ) {
      url =
        `${HOSTS[0]}${url}`;
    }

    return url;
  }

  return null;
}

/* ============================================================
 * PROCESAR MULTIPLAYER
 * ========================================================== */

async function processMultiplayerHtml(
  html: string,
  referer: string,
): Promise<AnimeD23Server[]> {
  /*
   * PRIMERA OPCIÓN:
   *
   * El HTML ya es el multiplayer.
   */

  let servers =
    extractVideoTabs(
      html,
    );

  if (
    servers.length
  ) {
    const expanded:
      AnimeD23Server[] = [
        ...servers,
      ];

    /*
     * Mytsumi → Archive
     */

    for (
      const server of
        servers
    ) {
      if (
        /mytsumi\.com/i.test(
          server.url,
        )
      ) {
        expanded.push(
          ...(
            await extractMytsumiArchive(
              server,
              referer,
            )
          ),
        );
      }
    }

    /*
     * Servidores de descarga.
     */

    expanded.push(
      ...extractDownloads(
        html,
      ),
    );

    return dedupeServers(
      expanded,
    );
  }

  /*
   * SEGUNDA OPCIÓN:
   *
   * La página contiene options.php.
   */

  const optionsUrl =
    extractOptionsUrl(
      html,
    );

  if (
    optionsUrl
  ) {
    console.log(
      "🔗 AnimeD23 options.php:",
      optionsUrl,
    );

    const optionsHtml =
      await fetchPage(
        optionsUrl,
        referer,
      );

    if (
      optionsHtml
    ) {
      return processMultiplayerHtml(
        optionsHtml,
        optionsUrl,
      );
    }
  }

  return [];
}

/* ============================================================
 * CAPÍTULO
 * ========================================================== */

async function processChapter(
  chapterUrl: string,
): Promise<AnimeD23Server[]> {
  console.log(
    "🎬 AnimeD23 capítulo:",
    chapterUrl,
  );

  const html =
    await fetchPage(
      chapterUrl,
    );

  if (!html) {
    return [];
  }

  /*
   * Intentamos directamente el HTML.
   *
   * Esto permite que si el capítulo ya contiene el
   * multiplayer, no hagamos otra cadena innecesaria.
   */

  let servers =
    await processMultiplayerHtml(
      html,
      chapterUrl,
    );

  if (
    servers.length
  ) {
    return servers;
  }

  /*
   * Si el capítulo contiene iframe, buscamos los src.
   */

  const source =
    normalizeSource(
      html,
    );

  const iframeRegex =
    /<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;

  const iframeUrls:
    string[] = [];

  for (
    const match of
      source.matchAll(
        iframeRegex,
      )
  ) {
    let url =
      normalizeUrl(
        match[1],
      );

    if (
      !/^https?:\/\//i.test(
        url,
      )
    ) {
      try {
        url =
          new URL(
            url,
            chapterUrl,
          ).href;
      } catch {
        continue;
      }
    }

    iframeUrls.push(
      normalizeUrl(url),
    );
  }

  for (
    const iframeUrl of
      iframeUrls
  ) {
    const iframeHtml =
      await fetchPage(
        iframeUrl,
        chapterUrl,
      );

    if (
      !iframeHtml
    ) {
      continue;
    }

    servers =
      await processMultiplayerHtml(
        iframeHtml,
        iframeUrl,
      );

    if (
      servers.length
    ) {
      return servers;
    }
  }

  return [];
}

/* ============================================================
 * EPISODIOS DESDE /anime/
 * ========================================================== */

function extractEpisodeLinks(
  html: string,
): string[] {
  const source =
    normalizeSource(
      html,
    );

  const result:
    string[] = [];

  const seen =
    new Set<string>();

  const add = (
    rawUrl: string,
  ) => {
    let url =
      normalizeUrl(
        rawUrl,
      );

    if (
      !/^https?:\/\//i.test(
        url,
      )
    ) {
      url =
        `${HOSTS[0]}${
          url.startsWith("/")
            ? ""
            : "/"
        }${url}`;
    }

    if (
      !/\/capitulo\//i.test(
        url,
      )
    ) {
      return;
    }

    if (
      seen.has(url)
    ) {
      return;
    }

    seen.add(url);
    result.push(url);
  };

  const hrefRegex =
    /<a\b[^>]*href\s*=\s*["']([^"']*\/capitulo\/[^"']+)["']/gi;

  for (
    const match of
      source.matchAll(
        hrefRegex,
      )
  ) {
    add(match[1]);
  }

  const rawRegex =
    /https?:\/\/animed23\.(?:com|online)\/capitulo\/[^"'<>\\\s]+/gi;

  for (
    const match of
      source.matchAll(
        rawRegex,
      )
  ) {
    add(match[0]);
  }

  return result;
}

/* ============================================================
 * EPISODIO EN URL
 * ========================================================== */

function episodeNumberFromUrl(
  url: string,
): number | null {
  const patterns = [
    /-ep-(\d+)(?:\/|$)/i,
    /-episodio-(\d+)(?:\/|$)/i,
    /-episode-(\d+)(?:\/|$)/i,
    /(?:^|-)cap(?:itulo)?-(\d+)(?:\/|$)/i,
  ];

  for (
    const pattern of
      patterns
  ) {
    const match =
      url.match(
        pattern,
      );

    if (
      match
    ) {
      return Number(
        match[1],
      );
    }
  }

  return null;
}

/* ============================================================
 * BUSCAR DESDE /anime/
 * ========================================================== */

async function findFromAnimePage(
  variant: string,
  episode: number,
): Promise<AnimeD23Server[]> {
  for (
    const host of
      HOSTS
  ) {
    const infoUrl =
      `${host}/anime/${variant}/`;

    console.log(
      "🔎 AnimeD23 anime:",
      infoUrl,
    );

    const html =
      await fetchPage(
        infoUrl,
      );

    if (!html) {
      continue;
    }

    const episodeLinks =
      extractEpisodeLinks(
        html,
      );

    /*
     * Primero URL cuyo número coincide.
     */

    const exact =
      episodeLinks.filter(
        url =>
          episodeNumberFromUrl(
            url,
          ) === episode,
      );

    for (
      const episodeUrl of
        exact
    ) {
      const servers =
        await processChapter(
          episodeUrl,
        );

      if (
        servers.length
      ) {
        return servers;
      }
    }

    /*
     * Luego todos los capítulos candidatos.
     *
     * Esto es importante porque AnimeD23 puede utilizar:
     *
     * /capitulo/anime-2026/
     *
     * sin escribir -ep-9 en la URL.
     */

    for (
      const episodeUrl of
        episodeLinks
    ) {
      const servers =
        await processChapter(
          episodeUrl,
        );

      if (
        servers.length
      ) {
        return servers;
      }
    }
  }

  return [];
}

/* ============================================================
 * URLS DIRECTAS DE CAPÍTULO
 *
 * Incluye el formato:
 *
 * /capitulo/boku-no-kokoro-no-yabai-yatsu-movie-2026/
 * ========================================================== */

function directChapterCandidates(
  variant: string,
  episode: number,
): string[] {
  const currentYear =
    new Date().getUTCFullYear();

  const years = [
    currentYear,
    currentYear - 1,
    currentYear + 1,
  ];

  const result =
    new Set<string>();

  for (
    const host of
      HOSTS
  ) {
    result.add(
      `${host}/capitulo/${variant}-ep-${episode}/`,
    );

    result.add(
      `${host}/capitulo/${variant}-episodio-${episode}/`,
    );

    result.add(
      `${host}/capitulo/${variant}-episode-${episode}/`,
    );

    /*
     * FORMATO REAL:
     *
     * anime-2026/
     */

    for (
      const year of
        years
    ) {
      result.add(
        `${host}/capitulo/${variant}-${year}/`,
      );
    }
  }

  return [
    ...result,
  ];
}

/* ============================================================
 * ORDEN
 * ========================================================== */

function sortServers(
  servers: AnimeD23Server[],
): AnimeD23Server[] {
  const priority = (
    server: AnimeD23Server,
  ): number => {
    const name =
      server.name
        .toLowerCase();

    const url =
      server.url
        .toLowerCase();

    if (
      name.includes("moon") ||
      url.includes(
        "bysesukior.com",
      )
    ) {
      return 0;
    }

    if (
      name.includes(
        "mytsumi",
      ) ||
      url.includes(
        "mytsumi.com",
      )
    ) {
      return 1;
    }

    if (
      name.includes(
        "archive",
      ) ||
      url.includes(
        "archive.org",
      )
    ) {
      return 2;
    }

    if (
      name.includes(
        "mega",
      ) ||
      url.includes(
        "mega.nz",
      )
    ) {
      return 3;
    }

    if (
      name.includes("ok") ||
      url.includes(
        "ok.ru",
      )
    ) {
      return 4;
    }

    if (
      name.includes(
        "epsilon",
      ) ||
      url.includes(
        "ytplay",
      )
    ) {
      return 5;
    }

    if (
      name.includes(
        "abyss",
      ) ||
      url.includes(
        "abyssplayer",
      )
    ) {
      return 6;
    }

    if (
      name.includes(
        "mp4upload",
      ) ||
      url.includes(
        "mp4upload",
      )
    ) {
      return 7;
    }

    if (
      name.includes(
        "zilla",
      ) ||
      url.includes(
        "zilla-networks",
      )
    ) {
      return 8;
    }

    return 20;
  };

  return [
    ...servers,
  ].sort(
    (a, b) =>
      priority(a) -
      priority(b),
  );
}

/* ============================================================
 * FUNCIÓN PRINCIPAL
 * ========================================================== */

export async function getAnimeD23Servers(
  slug: string,
  episode: number,
): Promise<AnimeD23Server[]> {
  if (
    !slug ||
    !Number.isFinite(
      episode,
    ) ||
    episode < 1
  ) {
    return [];
  }

  /*
   * AniList
   *
   * Conservamos el slug enviado por tu frontend y agregamos
   * userPreferred, english, romaji, native y synonyms.
   */

  const titles =
    new Set<string>();

  titles.add(slug);

  try {
    const metadata =
      await getAnimeMetadata(
        slug,
      );

    for (
      const title of
        metadata.titles ||
        []
    ) {
      if (
        title &&
        title.trim()
      ) {
        titles.add(
          title.trim(),
        );
      }
    }
  } catch (error) {
    console.log(
      "⚠️ AnimeD23 AniList:",
      error,
    );
  }

  /*
   * Crear todos los candidatos.
   */

  const variants =
    new Set<string>();

  for (
    const title of
      titles
  ) {
    for (
      const variant of
        generateTitleVariants(
          title,
        )
    ) {
      variants.add(
        variant,
      );
    }
  }

  console.log(
    "🔎 AnimeD23 variantes:",
    [...variants],
  );

  /*
   * ==========================================================
   * 1. BUSCAR EN /anime/
   * ==========================================================
   */

  for (
    const variant of
      variants
  ) {
    try {
      const servers =
        await findFromAnimePage(
          variant,
          episode,
        );

      if (
        servers.length
      ) {
        console.log(
          "✅ AnimeD23 encontrado:",
          variant,
          servers,
        );

        return sortServers(
          dedupeServers(
            servers,
          ),
        );
      }
    } catch (error) {
      console.log(
        "⚠️ AnimeD23 /anime:",
        variant,
        error,
      );
    }
  }

  /*
   * ==========================================================
   * 2. URLS DIRECTAS
   * ==========================================================
   */

  for (
    const variant of
      variants
  ) {
    const candidates =
      directChapterCandidates(
        variant,
        episode,
      );

    for (
      const chapterUrl of
        candidates
    ) {
      try {
        const servers =
          await processChapter(
            chapterUrl,
          );

        if (
          servers.length
        ) {
          console.log(
            "✅ AnimeD23 directo:",
            chapterUrl,
            servers,
          );

          return sortServers(
            dedupeServers(
              servers,
            ),
          );
        }
      } catch (error) {
        console.log(
          "⚠️ AnimeD23 capítulo:",
          chapterUrl,
          error,
        );
      }
    }
  }

  console.log(
    "❌ AnimeD23: ningún servidor encontrado",
    {
      slug,
      episode,
    },
  );

  return [];
}
