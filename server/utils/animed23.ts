import { getHeaders } from "./fetcher";
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
    .replace(/\\u003a/gi, ":")
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

  try {
    url = decodeURIComponent(url);
  } catch {
    // Puede contener caracteres % válidos.
  }

  /*
   * Solamente eliminamos barras duplicadas
   * después del host.
   *
   * NO usamos:
   *
   * url.replace(/\/{2,}/g, "/")
   *
   * porque destruiría https://
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
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /&/g,
      " and ",
    )
    .replace(
      /[^a-z0-9\s-]/g,
      " ",
    )
    .replace(
      /\s+/g,
      "-",
    )
    .replace(
      /-+/g,
      "-",
    )
    .replace(
      /^-|-$/g,
      "");
}

function generateTitleVariants(
  value: string,
): string[] {
  const base =
    slugify(value);

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
        .replace(
          /-+/g,
          "-",
        )
        .replace(
          /^-|-$/g,
          "",
        );

    if (clean) {
      variants.add(clean);
    }
  };

  add(base);

  /*
   * Temporadas.
   */

  const season =
    base.match(
      /^(.*?)-(?:temporada|season|t)-?(\d+)$/i,
    );

  if (season) {
    const title =
      season[1];

    const number =
      season[2];

    add(title);
    add(`${title}-${number}`);
    add(
      `${title}-temporada-${number}`,
    );
    add(
      `${title}-season-${number}`,
    );
    add(
      `${title}-${number}-season`,
    );
    add(
      `${title}-${number}th-season`,
    );
  }

  /*
   * 1st-season / 2nd-season...
   */

  const ordinal =
    base.match(
      /^(.*?)-(\d+)(?:st|nd|rd|th)-season$/i,
    );

  if (ordinal) {
    const title =
      ordinal[1];

    const number =
      ordinal[2];

    add(title);
    add(`${title}-${number}`);
    add(
      `${title}-${number}-season`,
    );
    add(
      `${title}-${number}th-season`,
    );
    add(
      `${title}-season-${number}`,
    );
    add(
      `${title}-temporada-${number}`,
    );
  }

  /*
   * AnimeD23 también utiliza años.
   */

  add(
    base.replace(
      /-(?:19|20)\d{2}$/,
      "",
    ),
  );

  add(
    base.replace(
      /-(?:season|temporada|part|parte|cour)-?\d+$/i,
      "",
    ),
  );

  return [
    ...variants,
  ].slice(
    0,
    50,
  );
}

/* ============================================================
 * PROVIDER
 * ========================================================== */

function providerName(
  url: string,
  explicitName?: string,
): string {
  if (
    explicitName &&
    explicitName.trim()
  ) {
    return explicitName.trim();
  }

  for (
    const provider of
      PROVIDERS
  ) {
    if (
      provider.pattern.test(
        url,
      )
    ) {
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

  const result:
    AnimeD23Server[] = [];

  for (
    const server of
      servers
  ) {
    const url =
      normalizeUrl(
        server.url,
      );

    if (
      !/^https?:\/\//i.test(
        url,
      )
    ) {
      continue;
    }

    const key =
      url
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
        providerName(
          url,
          server.name,
        ),
      url,
      type:
        serverType(
          url,
        ),
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
    const headers:
      Record<string, string> = {
      ...getHeaders(url),

      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };

    if (referer) {
      headers.Referer =
        referer;
    }

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        15000,
      );

    try {
      const response =
        await fetch(
          url,
          {
            method: "GET",
            headers,
            redirect: "follow",
            signal:
              controller.signal,
          },
        );

      if (
        !response.ok
      ) {
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
    } finally {
      clearTimeout(
        timeout,
      );
    }
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
 * BASE64
 *
 * NUEVO:
 *
 * <option value="BASE64">
 *       ↓
 * HTML
 *       ↓
 * iframe src
 *
 * Esto viene directamente de la lógica del scraper que me
 * pasaste.
 * ========================================================== */

function decodeBase64Html(
  value: string,
): string | null {
  try {
    let encoded =
      normalizeSource(
        value,
      ).trim();

    try {
      encoded =
        decodeURIComponent(
          encoded,
        );
    } catch {
      // Puede no estar URL encoded.
    }

    /*
     * Admitimos Base64 normal y Base64URL.
     */

    encoded =
      encoded
        .replace(
          /-/g,
          "+",
        )
        .replace(
          /_/g,
          "/",
        );

    encoded +=
      "=".repeat(
        (4 -
          (encoded.length %
            4)) %
          4,
      );

    const binary =
      atob(
        encoded,
      );

    const bytes =
      new Uint8Array(
        binary.length,
      );

    for (
      let i = 0;
      i < binary.length;
      i++
    ) {
      bytes[i] =
        binary.charCodeAt(i);
    }

    return new TextDecoder().decode(
      bytes,
    );
  } catch (error) {
    console.log(
      "⚠️ AnimeD23 Base64 inválido:",
      error,
    );

    return null;
  }
}

/* ============================================================
 * MIRROR SELECTOR
 *
 * ESTE ES EL CAMBIO PRINCIPAL.
 *
 * Busca:
 *
 * <select class="mirror">
 *   <option value="...BASE64...">
 *
 * Después:
 *
 * Base64
 *   ↓
 * iframe src
 *   ↓
 * player.php
 *   ↓
 * contenedor.php
 *   ↓
 * servidores
 * ========================================================== */

function extractMirrorIframeUrls(
  html: string,
): string[] {
  const source =
    normalizeSource(
      html,
    );

  const result =
    new Set<string>();

  const selectRegex =
    /<select\b[^>]*\bclass\s*=\s*["'][^"']*\bmirror\b[^"']*["'][^>]*>([\s\S]*?)<\/select>/gi;

  for (
    const selectMatch of
      source.matchAll(
        selectRegex,
      )
  ) {
    const selectHtml =
      selectMatch[1];

    const optionRegex =
      /<option\b[^>]*\bvalue\s*=\s*["']([^"']+)["'][^>]*>/gi;

    for (
      const optionMatch of
        selectHtml.matchAll(
          optionRegex,
        )
    ) {
      const encoded =
        optionMatch[1];

      if (
        !encoded ||
        encoded.length < 10
      ) {
        continue;
      }

      const decoded =
        decodeBase64Html(
          encoded,
        );

      if (!decoded) {
        continue;
      }

      console.log(
        "🪞 AnimeD23 mirror decodificado:",
        decoded.slice(
          0,
          300,
        ),
      );

      /*
       * Buscar iframe dentro del HTML decodificado.
       */

      const iframeRegex =
        /<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i;

      const iframeMatch =
        decoded.match(
          iframeRegex,
        );

      if (
        iframeMatch?.[1]
      ) {
        const url =
          normalizeUrl(
            iframeMatch[1],
          );

        if (
          /^https?:\/\//i.test(
            url,
          )
        ) {
          result.add(
            url,
          );
        }
      }

      /*
       * Fallback:
       * si el contenido decodificado contiene directamente
       * una URL.
       */

      const directRegex =
        /https?:\/\/[^\s"'<>]+/i;

      const directMatch =
        decoded.match(
          directRegex,
        );

      if (
        directMatch?.[0]
      ) {
        const url =
          normalizeUrl(
            directMatch[0],
          );

        if (
          /^https?:\/\//i.test(
            url,
          )
        ) {
          result.add(
            url,
          );
        }
      }
    }
  }

  console.log(
    "🪞 AnimeD23 mirror iframes:",
    [
      ...result,
    ],
  );

  return [
    ...result,
  ];
}

/* ============================================================
 * EXTRACTOR DE ARRAY JAVASCRIPT
 * ========================================================== */

function extractBalancedArray(
  source: string,
  marker: string,
): string | null {
  const markerIndex =
    source.search(
      new RegExp(
        `(?:const|let|var)?\\s*${marker}\\s*=`,
        "i",
      ),
    );

  if (
    markerIndex < 0
  ) {
    return null;
  }

  const start =
    source.indexOf(
      "[",
      markerIndex,
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

      if (
        depth === 0
      ) {
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
 * ========================================================== */

function extractBalancedObject(
  source: string,
  marker: string,
): string | null {
  const markerIndex =
    source.search(
      new RegExp(
        `(?:const|let|var)?\\s*${marker}\\s*=`,
        "i",
      ),
    );

  if (
    markerIndex < 0
  ) {
    return null;
  }

  const start =
    source.indexOf(
      "{",
      markerIndex,
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

      if (
        depth === 0
      ) {
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
      "videoTabs",
    );

  if (
    !arrayText
  ) {
    console.log(
      "⚠️ AnimeD23: videoTabs no encontrado",
    );

    return [];
  }

  const result:
    AnimeD23Server[] = [];

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
      !Array.isArray(
        tabs,
      )
    ) {
      return [];
    }

    for (
      const tab of
        tabs
    ) {
      if (
        !tab ||
        tab.status ===
          "inactive"
      ) {
        continue;
      }

      const url =
        normalizeUrl(
          tab.url ||
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
            tab.tab_name,
          ),
        url,
        type:
          serverType(
            url,
          ),
      });
    }
  } catch (error) {
    console.log(
      "⚠️ AnimeD23 videoTabs no es JSON estricto:",
      error,
    );

    /*
     * Fallback para JS ligeramente distinto.
     */

    const urlRegex =
      /["']?(?:url|src|embed|link)["']?\s*:\s*["'](https?:\/\/[^"']+)["']/gi;

    for (
      const match of
        source.matchAll(
          urlRegex,
        )
    ) {
      const url =
        normalizeUrl(
          match[1],
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
          ),
        url,
        type:
          serverType(
            url,
          ),
      });
    }
  }

  console.log(
    "🎥 AnimeD23 videoTabs:",
    result,
  );

  return dedupeServers(
    result,
  );
}

/* ============================================================
 * DOWNLOADS
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
      "downloadsByQuality",
    );

  if (
    !objectText
  ) {
    return [];
  }

  const result:
    AnimeD23Server[] = [];

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
            serverType(
              url,
            ),
        });
      }
    }
  } catch {
    /*
     * Fallback.
     */

    const urlRegex =
      /(?:download_url|url|src)\s*:\s*["'](https?:\/\/[^"']+)["']/gi;

    for (
      const match of
        objectText.matchAll(
          urlRegex,
        )
    ) {
      const url =
        normalizeUrl(
          match[1],
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
          ),
        url,
        type:
          serverType(
            url,
          ),
      });
    }
  }

  return dedupeServers(
    result,
  );
}

/* ============================================================
 * A / IFRAME / SOURCE
 * ========================================================== */

function extractKnownUrls(
  html: string,
): AnimeD23Server[] {
  const source =
    normalizeSource(
      html,
    );

  const result:
    AnimeD23Server[] = [];

  const patterns = [
    /<(?:a|iframe|source)\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi,
    /<(?:a|iframe|source)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi,
  ];

  for (
    const pattern of
      patterns
  ) {
    for (
      const match of
        source.matchAll(
          pattern,
        )
    ) {
      const url =
        normalizeUrl(
          match[1],
        );

      if (
        !/^https?:\/\//i.test(
          url,
        )
      ) {
        continue;
      }

      if (
        !PROVIDERS.some(
          provider =>
            provider.pattern.test(
              url,
            ),
        )
      ) {
        continue;
      }

      result.push({
        name:
          providerName(
            url,
          ),
        url,
        type:
          serverType(
            url,
          ),
      });
    }
  }

  return dedupeServers(
    result,
  );
}

/* ============================================================
 * ARCHIVE
 *
 * Especialmente:
 *
 * Mytsumi
 *   ↓
 * <video src="https://archive.org/...">
 *
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
      !/^https?:\/\/[^/]*archive\.org\//i.test(
        url,
      )
    ) {
      return;
    }

    const key =
      url.toLowerCase();

    if (
      seen.has(key)
    ) {
      return;
    }

    seen.add(key);

    result.push({
      name:
        "Archive",
      url,
      type:
        "mp4",
    });
  };

  const videoRegex =
    /<video\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;

  const sourceRegex =
    /<source\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;

  for (
    const match of
      source.matchAll(
        videoRegex,
      )
  ) {
    add(
      match[1],
    );
  }

  for (
    const match of
      source.matchAll(
        sourceRegex,
      )
  ) {
    add(
      match[1],
    );
  }

  /*
   * Archive dentro de JavaScript.
   */

  const archiveRegex =
    /https?:\/\/[^"'<>\\\s]*archive\.org\/[^"'<>\\\s]+/gi;

  for (
    const match of
      source.matchAll(
        archiveRegex,
      )
  ) {
    add(
      match[0],
    );
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
 * PROVIDERS
 * ========================================================== */

function isInterestingProviderUrl(
  url: string,
): boolean {
  return PROVIDERS.some(
    provider =>
      provider.pattern.test(
        url,
      ),
  );
}

/* ============================================================
 * PROCESAR PÁGINA
 *
 * Este es el núcleo nuevo:
 *
 * mirror
 *   ↓
 * player.php
 *   ↓
 * contenedor.php
 *   ↓
 * iframe
 *   ↓
 * provider
 *
 * ========================================================== */

async function processPage(
  html: string,
  pageUrl: string,
  depth: number,
  visited: Set<string>,
): Promise<AnimeD23Server[]> {
  /*
   * Evitar cadenas infinitas.
   */

  if (
    depth > 5
  ) {
    return [];
  }

  let servers:
    AnimeD23Server[] = [];

  /*
   * ----------------------------------------------------------
   * 1. videoTabs
   * ----------------------------------------------------------
   */

  servers.push(
    ...extractVideoTabs(
      html,
    ),
  );

  /*
   * ----------------------------------------------------------
   * 2. downloadsByQuality
   * ----------------------------------------------------------
   */

  servers.push(
    ...extractDownloads(
      html,
    ),
  );

  /*
   * ----------------------------------------------------------
   * 3. Servidores explícitos
   * ----------------------------------------------------------
   */

  servers.push(
    ...extractKnownUrls(
      html,
    ),
  );

  /*
   * ----------------------------------------------------------
   * 4. MIRROR SELECTOR
   *
   * Esto es lo que no tenía la versión anterior.
   * ----------------------------------------------------------
   */

  const mirrorIframes =
    extractMirrorIframeUrls(
      html,
    );

  /*
   * ----------------------------------------------------------
   * 5. Iframes normales
   * ----------------------------------------------------------
   */

  const iframeUrls:
    string[] = [
      ...mirrorIframes,
    ];

  const source =
    normalizeSource(
      html,
    );

  const iframeRegex =
    /<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;

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
            pageUrl,
          ).href;
      } catch {
        continue;
      }
    }

    iframeUrls.push(
      normalizeUrl(
        url,
      ),
    );
  }

  const uniqueIframes =
    [
      ...new Set(
        iframeUrls.filter(
          url =>
            /^https?:\/\//i.test(
              url,
            ),
        ),
      ),
    ];

  /*
   * ----------------------------------------------------------
   * 6. MYTSUMI → ARCHIVE
   * ----------------------------------------------------------
   */

  const currentServers =
    dedupeServers(
      servers,
    );

  for (
    const server of
      currentServers
  ) {
    if (
      /mytsumi\.com/i.test(
        server.url,
      )
    ) {
      servers.push(
        ...(
          await extractMytsumiArchive(
            server,
            pageUrl,
          )
        ),
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * 7. RECURRIR EN IFRAMES INTERNOS
   *
   * IMPORTANTE:
   *
   * No entramos a Mega/Zilla/etc. porque son el servidor final.
   *
   * Sí entramos a:
   *
   * animed23.online
   * animed23.com
   * Mytsumi
   *
   * para continuar el árbol.
   * ----------------------------------------------------------
   */

  for (
    const iframeUrl of
      uniqueIframes
  ) {
    const key =
      iframeUrl.toLowerCase();

    if (
      visited.has(key)
    ) {
      continue;
    }

    /*
     * Los servidores finales no necesitan ser descargados.
     *
     * Mytsumi es excepción porque allí buscamos Archive.
     */

    if (
      isInterestingProviderUrl(
        iframeUrl,
      ) &&
      !/mytsumi\.com/i.test(
        iframeUrl,
      )
    ) {
      continue;
    }

    visited.add(
      key,
    );

    const iframeHtml =
      await fetchPage(
        iframeUrl,
        pageUrl,
      );

    if (!iframeHtml) {
      continue;
    }

    const nested =
      await processPage(
        iframeHtml,
        iframeUrl,
        depth + 1,
        visited,
      );

    servers.push(
      ...nested,
    );
  }

  /*
   * ----------------------------------------------------------
   * 8. OPTIONS.PHP COMO FALLBACK
   * ----------------------------------------------------------
   */

  if (
    !servers.length
  ) {
    const optionsUrl =
      extractOptionsUrl(
        html,
      );

    if (
      optionsUrl &&
      !visited.has(
        optionsUrl.toLowerCase(),
      )
    ) {
      console.log(
        "🔗 AnimeD23 options.php:",
        optionsUrl,
      );

      visited.add(
        optionsUrl.toLowerCase(),
      );

      const optionsHtml =
        await fetchPage(
          optionsUrl,
          pageUrl,
        );

      if (
        optionsHtml
      ) {
        servers.push(
          ...(
            await processPage(
              optionsHtml,
              optionsUrl,
              depth + 1,
              visited,
            )
          ),
        );
      }
    }
  }

  return dedupeServers(
    servers,
  );
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

  const visited =
    new Set<string>();

  visited.add(
    chapterUrl.toLowerCase(),
  );

  return processPage(
    html,
    chapterUrl,
    0,
    visited,
  );
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
    add(
      match[1],
    );
  }

  const rawRegex =
    /https?:\/\/animed23\.(?:com|online)\/capitulo\/[^"'<>\\\s]+/gi;

  for (
    const match of
      source.matchAll(
        rawRegex,
      )
  ) {
    add(
      match[0],
    );
  }

  return result;
}

/* ============================================================
 * NÚMERO DE EPISODIO
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
     * Primero capítulo cuyo número coincide.
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
     * Si AnimeD23 utiliza una URL que no incluye
     * explícitamente el número, probamos los demás.
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
 * URLs DIRECTAS
 * ========================================================== */

function directChapterCandidates(
  variant: string,
  episode: number,
): string[] {
  const currentYear =
    new Date()
      .getUTCFullYear();

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
 * ORDEN INTERNO ANIMED23
 * ========================================================== */

function sortServers(
  servers: AnimeD23Server[],
): AnimeD23Server[] {
  const priority =
    (
      server:
        AnimeD23Server,
    ): number => {
      const name =
        server.name
          .toLowerCase();

      const url =
        server.url
          .toLowerCase();

      if (
        name.includes(
          "moon",
        ) ||
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
        name.includes(
          "ok",
        ) ||
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
   * ==========================================================
   * METADATA
   * ==========================================================
   */

  const titles =
    new Set<string>();

  titles.add(
    slug,
  );

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
      "⚠️ AnimeD23 metadata:",
      error,
    );
  }

  /*
   * ==========================================================
   * VARIANTES
   * ==========================================================
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
    [
      ...variants,
    ],
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
   * 2. URLs DIRECTAS
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
