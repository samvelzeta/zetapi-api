import { fetchHtml, getHeaders } from "./fetcher";

export interface AnimeD23Server {
  name: string;
  url: string;
  type: "iframe" | "mp4";
}

interface EpisodeLink {
  url: string;
  text: string;
  slug: string;
}

const HOSTS = [
  "https://animed23.com",
  "https://animed23.online",
];

/* ============================================================
 * NORMALIZACIÓN
 * ========================================================== */

function decodeHtml(value: string): string {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/gi, "/")
    .replace(/&nbsp;/gi, " ")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .trim();
}

function normalizeTitle(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return normalizeTitle(value)
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ============================================================
 * VARIANTES DE TÍTULO
 * ========================================================== */

function generateSlugVariants(
  value: string,
): string[] {
  const base = slugify(value);

  if (!base) {
    return [];
  }

  const result = new Set<string>();

  const add = (candidate: string) => {
    candidate = candidate
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (candidate) {
      result.add(candidate);
    }
  };

  add(base);

  /*
   * Temporada 4
   */
  const seasonMatch = base.match(
    /^(.*?)-(?:temporada|season|t)-?(\d+)$/i,
  );

  if (seasonMatch) {
    const title = seasonMatch[1];
    const number = seasonMatch[2];

    add(title);
    add(`${title}-${number}`);
    add(`${title}-${number}-season`);
    add(`${title}-${number}th-season`);
    add(`${title}-season-${number}`);
    add(`${title}-temporada-${number}`);
  }

  /*
   * 4th-season
   */
  const ordinalMatch = base.match(
    /^(.*?)-(\d+)(?:st|nd|rd|th)-season$/i,
  );

  if (ordinalMatch) {
    const title = ordinalMatch[1];
    const number = ordinalMatch[2];

    add(title);
    add(`${title}-${number}`);
    add(`${title}-${number}-season`);
    add(`${title}-${number}th-season`);
    add(`${title}-season-${number}`);
    add(`${title}-temporada-${number}`);
  }

  /*
   * Quitar año.
   */
  add(
    base.replace(
      /-(?:19|20)\d{2}$/,
      "",
    ),
  );

  /*
   * Quitar temporada.
   */
  add(
    base.replace(
      /-(?:temporada|season|part|parte|cour|t)-?\d+$/i,
      "",
    ),
  );

  /*
   * Movie.
   */
  if (base.endsWith("-movie")) {
    add(
      base.replace(
        /-movie$/,
        "",
      ),
    );
  }

  return [...result].slice(
    0,
    50,
  );
}

/* ============================================================
 * EXTRAER hrefs DE CAPÍTULOS
 *
 * NO suponemos que todos sean:
 *
 * /capitulo/slug-ep-1/
 *
 * Puede ser:
 *
 * /capitulo/slug-ep-9/
 * /capitulo/slug-2026/
 * /capitulo/slug-1/
 * etc.
 * ========================================================== */

function extractEpisodeLinks(
  html: string,
): EpisodeLink[] {
  const result: EpisodeLink[] = [];
  const seen = new Set<string>();

  /*
   * Primero buscamos cualquier href que contenga
   * /capitulo/.
   */
  const hrefRegex =
    /<a\b[^>]*href\s*=\s*["']([^"']*\/capitulo\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while (
    (match = hrefRegex.exec(html)) !== null
  ) {
    let url = decodeHtml(
      match[1],
    );

    if (
      !/^https?:\/\//i.test(url)
    ) {
      url =
        `${HOSTS[0]}${url.startsWith("/") ? "" : "/"}${url}`;
    }

    try {
      const parsed =
        new URL(url);

      const parts =
        parsed.pathname
          .split("/")
          .filter(Boolean);

      const index =
        parts.findIndex(
          p =>
            p.toLowerCase() ===
            "capitulo",
        );

      if (
        index < 0 ||
        !parts[index + 1]
      ) {
        continue;
      }

      const slug =
        parts[index + 1];

      const key =
        url.toLowerCase();

      if (
        seen.has(key)
      ) {
        continue;
      }

      seen.add(key);

      const text =
        decodeHtml(
          match[2]
            .replace(
              /<[^>]+>/g,
              " ",
            )
            .replace(
              /\s+/g,
              " ",
            )
            .trim(),
        );

      result.push({
        url,
        slug,
        text,
      });
    } catch {
      continue;
    }
  }

  /*
   * Algunos sitios meten las URLs en scripts
   * en vez de <a>.
   */
  const rawRegex =
    /https?:\/\/animed23\.(?:com|online)\/capitulo\/[A-Za-z0-9%._~:/?#\[\]@!$&()*+,;=-]+/gi;

  while (
    (match = rawRegex.exec(html)) !== null
  ) {
    const url =
      decodeHtml(
        match[0],
      );

    try {
      const parsed =
        new URL(url);

      const parts =
        parsed.pathname
          .split("/")
          .filter(Boolean);

      const index =
        parts.findIndex(
          p =>
            p.toLowerCase() ===
            "capitulo",
        );

      if (
        index < 0 ||
        !parts[index + 1]
      ) {
        continue;
      }

      const slug =
        parts[index + 1];

      const key =
        url.toLowerCase();

      if (
        seen.has(key)
      ) {
        continue;
      }

      seen.add(key);

      result.push({
        url,
        slug,
        text: slug,
      });
    } catch {
      continue;
    }
  }

  return result;
}

/* ============================================================
 * DETECTAR NÚMERO DE EPISODIO
 * ========================================================== */

function extractEpisodeNumber(
  value: string,
): number | null {
  const text =
    String(value || "")
      .toLowerCase();

  const patterns = [
    /(?:^|[-_\s])ep(?:isode|isodio)?[-_\s]*(\d+)(?:$|[-_\s])/i,
    /(?:^|[-_\s])episodio[-_\s]*(\d+)(?:$|[-_\s])/i,
    /(?:^|[-_\s])episode[-_\s]*(\d+)(?:$|[-_\s])/i,
    /(?:^|[-_\s])cap(?:itulo)?[-_\s]*(\d+)(?:$|[-_\s])/i,
  ];

  for (
    const pattern of patterns
  ) {
    const match =
      text.match(pattern);

    if (match) {
      return Number(
        match[1],
      );
    }
  }

  return null;
}

/* ============================================================
 * ELEGIR EPISODIO
 * ========================================================== */

function selectEpisode(
  episodes: EpisodeLink[],
  number: number,
  animeSlug: string,
): EpisodeLink | null {
  if (!episodes.length) {
    return null;
  }

  /*
   * 1. Coincidencia exacta por número.
   */
  for (
    const episode of episodes
  ) {
    const detected =
      extractEpisodeNumber(
        `${episode.slug} ${episode.text}`,
      );

    if (
      detected === number
    ) {
      return episode;
    }
  }

  /*
   * 2. Buscar "ep-X".
   */
  const epRegex =
    new RegExp(
      `(?:^|[-_])ep[-_]?${number}(?:$|[-_])`,
      "i",
    );

  for (
    const episode of episodes
  ) {
    if (
      epRegex.test(
        episode.slug,
      )
    ) {
      return episode;
    }
  }

  /*
   * 3. Si el anime es una película,
   * AnimeD23 puede usar:
   *
   * /capitulo/anime-2026/
   *
   * En ese caso normalmente solamente
   * existe un capítulo.
   *
   * Si hay un solo resultado, lo usamos.
   */
  if (
    episodes.length === 1
  ) {
    return episodes[0];
  }

  /*
   * 4. Buscar coincidencia del slug.
   */
  const normalizedAnime =
    slugify(animeSlug);

  const candidates =
    episodes.filter(
      episode =>
        normalizeTitle(
          episode.slug,
        ).includes(
          normalizeTitle(
            normalizedAnime,
          ),
        ),
    );

  if (
    candidates.length === 1
  ) {
    return candidates[0];
  }

  /*
   * 5. Si existe exactamente un
   * enlace que no tiene número,
   * probablemente sea película.
   */
  const withoutNumber =
    episodes.filter(
      episode =>
        extractEpisodeNumber(
          episode.slug,
        ) === null,
    );

  if (
    withoutNumber.length === 1
  ) {
    return withoutNumber[0];
  }

  return null;
}

/* ============================================================
 * EXTRAER URL DE options.php
 *
 * Esta es la parte CRÍTICA del HTML del capítulo.
 * ========================================================== */

function extractOptionsUrl(
  html: string,
): string | null {
  /*
   * Normalizar HTML escapado.
   */
  const source =
    String(html || "")
      .replace(/\\\//g, "/")
      .replace(/\\u0026/gi, "&")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"');

  /*
   * Caso directo:
   *
   * https://animed23.online/opciones/options.php?...
   */
  const absoluteRegex =
    /https?:\/\/animed23\.(?:com|online)\/opciones\/options\.php\?server=multi&value=[^"'<>\\\s]+/i;

  const absolute =
    source.match(
      absoluteRegex,
    );

  if (
    absolute?.[0]
  ) {
    return decodeHtml(
      absolute[0],
    );
  }

  /*
   * Caso iframe:
   *
   * <iframe src="...options.php?...">
   */
  const iframeRegex =
    /<iframe\b[^>]*src\s*=\s*["']([^"']*\/opciones\/options\.php\?[^"']+)["']/i;

  const iframe =
    source.match(
      iframeRegex,
    );

  if (
    iframe?.[1]
  ) {
    let url =
      decodeHtml(
        iframe[1],
      );

    if (
      !/^https?:\/\//i.test(url)
    ) {
      url =
        `${HOSTS[0]}${url.startsWith("/") ? "" : "/"}${url}`;
    }

    return url;
  }

  /*
   * Caso genérico.
   */
  const genericRegex =
    /(?:src|href)\s*=\s*["']([^"']*options\.php\?server=multi[^"']+)["']/i;

  const generic =
    source.match(
      genericRegex,
    );

  if (
    generic?.[1]
  ) {
    let url =
      decodeHtml(
        generic[1],
      );

    if (
      !/^https?:\/\//i.test(url)
    ) {
      url =
        `${HOSTS[0]}${url.startsWith("/") ? "" : "/"}${url}`;
    }

    return url;
  }

  return null;
}

/* ============================================================
 * EXTRAER videoTabs
 *
 * EXACTAMENTE como aparece en el HTML real:
 *
 * const videoTabs = [{...},{...}];
 * ========================================================== */

function extractVideoTabs(
  html: string,
): AnimeD23Server[] {
  const source =
    String(html || "")
      .replace(/\\\//g, "/")
      .replace(/\\u0026/gi, "&")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"');

  const marker =
    source.indexOf(
      "const videoTabs",
    );

  if (
    marker < 0
  ) {
    console.log(
      "⚠️ AnimeD23: no existe 'const videoTabs'",
    );

    return [];
  }

  const arrayStart =
    source.indexOf(
      "[",
      marker,
    );

  if (
    arrayStart < 0
  ) {
    console.log(
      "⚠️ AnimeD23: videoTabs sin '['",
    );

    return [];
  }

  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  let arrayEnd = -1;

  for (
    let i = arrayStart;
    i < source.length;
    i++
  ) {
    const char =
      source[i];

    if (
      quote !== null
    ) {
      if (
        escaped
      ) {
        escaped = false;
        continue;
      }

      if (
        char === "\\"
      ) {
        escaped = true;
        continue;
      }

      if (
        char === quote
      ) {
        quote = null;
      }

      continue;
    }

    if (
      char === '"' ||
      char === "'" ||
      char === "`"
    ) {
      quote = char;
      continue;
    }

    if (
      char === "["
    ) {
      depth++;
      continue;
    }

    if (
      char === "]"
    ) {
      depth--;

      if (
        depth === 0
      ) {
        arrayEnd =
          i;
        break;
      }
    }
  }

  if (
    arrayEnd < 0
  ) {
    console.log(
      "⚠️ AnimeD23: no se encontró cierre de videoTabs",
    );

    return [];
  }

  const arrayText =
    source.slice(
      arrayStart,
      arrayEnd + 1,
    );

  let tabs: any[];

  try {
    tabs =
      JSON.parse(
        arrayText,
      );
  } catch (error) {
    console.log(
      "❌ AnimeD23: JSON videoTabs inválido:",
      error,
    );

    return [];
  }

  if (
    !Array.isArray(tabs)
  ) {
    return [];
  }

  const result:
    AnimeD23Server[] = [];

  const seen =
    new Set<string>();

  for (
    const tab of tabs
  ) {
    if (!tab) {
      continue;
    }

    const url =
      decodeHtml(
        String(
          tab.url ||
          "",
        ),
      ).trim();

    if (
      !/^https?:\/\//i.test(
        url,
      )
    ) {
      continue;
    }

    /*
     * Solo servidores activos.
     */
    if (
      tab.status &&
      String(
        tab.status,
      ).toLowerCase() !==
        "active"
    ) {
      continue;
    }

    /*
     * Evitar duplicados.
     */
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
      continue;
    }

    seen.add(key);

    let name =
      String(
        tab.tab_name ||
        tab.name ||
        "",
      ).trim();

    if (
      !name
    ) {
      name =
        detectServerName(
          url,
        );
    }

    result.push({
      name,
      url,
      type:
        /\.mp4(?:$|\?)/i.test(
          url,
        )
          ? "mp4"
          : "iframe",
    });
  }

  return result;
}

/* ============================================================
 * EXTRAER downloadsByQuality
 *
 * AnimeD23 también guarda servidores de descarga
 * en el mismo HTML.
 *
 * Esto es opcional, pero aprovechamos la misma respuesta.
 * ========================================================== */

function extractDownloads(
  html: string,
): AnimeD23Server[] {
  const source =
    String(html || "")
      .replace(/\\\//g, "/")
      .replace(/\\u0026/gi, "&")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"');

  const marker =
    source.indexOf(
      "const downloadsByQuality",
    );

  if (
    marker < 0
  ) {
    return [];
  }

  const start =
    source.indexOf(
      "{",
      marker,
    );

  if (
    start < 0
  ) {
    return [];
  }

  let depth = 0;
  let quote: string | null = null;
  let escaped = false;
  let end = -1;

  for (
    let i = start;
    i < source.length;
    i++
  ) {
    const char =
      source[i];

    if (
      quote !== null
    ) {
      if (
        escaped
      ) {
        escaped = false;
        continue;
      }

      if (
        char === "\\"
      ) {
        escaped = true;
        continue;
      }

      if (
        char === quote
      ) {
        quote = null;
      }

      continue;
    }

    if (
      char === '"' ||
      char === "'" ||
      char === "`"
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
        end = i;
        break;
      }
    }
  }

  if (
    end < 0
  ) {
    return [];
  }

  const objectText =
    source.slice(
      start,
      end + 1,
    );

  let data: any;

  try {
    data =
      JSON.parse(
        objectText,
      );
  } catch {
    return [];
  }

  const result:
    AnimeD23Server[] = [];

  const seen =
    new Set<string>();

  for (
    const quality of Object.keys(
      data || {},
    )
  ) {
    const downloads =
      data[quality];

    if (
      !Array.isArray(
        downloads,
      )
    ) {
      continue;
    }

    for (
      const item of downloads
    ) {
      const url =
        decodeHtml(
          String(
            item?.download_url ||
            "",
          ),
        ).trim();

      if (
        !/^https?:\/\//i.test(
          url,
        )
      ) {
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
          String(
            item?.server_name ||
            detectServerName(url),
          ),
        url,
        type:
          /\.mp4(?:$|\?)/i.test(
            url,
          )
            ? "mp4"
            : "iframe",
      });
    }
  }

  return result;
}

/* ============================================================
 * NOMBRE DEL SERVIDOR
 * ========================================================== */

function detectServerName(
  url: string,
): string {
  const value =
    url.toLowerCase();

  if (
    value.includes(
      "bysesukior",
    )
  ) {
    return "Moon";
  }

  if (
    value.includes(
      "mytsumi",
    )
  ) {
    return "Mytsumi";
  }

  if (
    value.includes(
      "mega.nz",
    )
  ) {
    return "Mega";
  }

  if (
    value.includes(
      "ok.ru",
    )
  ) {
    return "OK";
  }

  if (
    value.includes(
      "ytplay",
    )
  ) {
    return "Epsilon";
  }

  if (
    value.includes(
      "abyssplayer",
    )
  ) {
    return "Abyss";
  }

  if (
    value.includes(
      "archive.org",
    )
  ) {
    return "Archive";
  }

  if (
    value.includes(
      "mediafire",
    )
  ) {
    return "Fire";
  }

  if (
    value.includes(
      "gofile",
    )
  ) {
    return "GoFile";
  }

  if (
    value.includes(
      "fireload",
    )
  ) {
    return "FireLoad";
  }

  if (
    value.includes(
      "terabox",
    )
  ) {
    return "Tera";
  }

  return "AnimeD23";
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
      server.name.toLowerCase();

    if (
      name.includes("moon")
    ) {
      return 0;
    }

    if (
      name.includes("archive")
    ) {
      return 1;
    }

    if (
      name.includes("mytsumi")
    ) {
      return 2;
    }

    if (
      name.includes("mega")
    ) {
      return 3;
    }

    if (
      name === "ok"
    ) {
      return 4;
    }

    if (
      name.includes("epsilon")
    ) {
      return 5;
    }

    if (
      name.includes("abyss")
    ) {
      return 6;
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
 * OBTENER HTML DEL PLAYER
 * ========================================================== */

async function getEpisodePlayer(
  episodeUrl: string,
): Promise<AnimeD23Server[]> {
  console.log(
    "🎬 AnimeD23 player:",
    episodeUrl,
  );

  const html =
    await fetchHtml(
      episodeUrl,
    );

  if (
    !html
  ) {
    console.log(
      "❌ AnimeD23: no se pudo obtener el player",
    );

    return [];
  }

  console.log(
    "📄 AnimeD23 player HTML:",
    html.length,
    "bytes",
  );

  /*
   * ----------------------------------------------------------
   * PASO 1
   *
   * Extraer options.php.
   * ----------------------------------------------------------
   */

  const optionsUrl =
    extractOptionsUrl(
      html,
    );

  if (
    !optionsUrl
  ) {
    console.log(
      "❌ AnimeD23: no se encontró options.php en el player",
    );

    return [];
  }

  console.log(
    "🔗 AnimeD23 options.php:",
    optionsUrl,
  );

  /*
   * ----------------------------------------------------------
   * PASO 2
   *
   * Obtener options.php.
   *
   * IMPORTANTE:
   *
   * NO usamos fetchHtml aquí porque queremos
   * exactamente el HTML que contiene videoTabs.
   * ----------------------------------------------------------
   */

  let response: Response;

  try {
    response =
      await fetch(
        optionsUrl,
        {
          method: "GET",
          headers: {
            ...getHeaders(
              optionsUrl,
            ),

            Referer:
              episodeUrl,

            Origin:
              new URL(
                episodeUrl,
              ).origin,

            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },

          redirect:
            "follow",
        },
      );
  } catch (error) {
    console.log(
      "❌ AnimeD23 options fetch:",
      error,
    );

    return [];
  }

  if (
    !response.ok
  ) {
    console.log(
      "❌ AnimeD23 options HTTP:",
      response.status,
    );

    return [];
  }

  const optionsHtml =
    await response.text();

  console.log(
    "📄 AnimeD23 options HTML:",
    optionsHtml.length,
    "bytes",
  );

  /*
   * ----------------------------------------------------------
   * PASO 3
   *
   * AQUÍ extraemos exactamente:
   *
   * const videoTabs = [...]
   * ----------------------------------------------------------
   */

  const videoServers =
    extractVideoTabs(
      optionsHtml,
    );

  console.log(
    "🎥 AnimeD23 videoTabs:",
    videoServers.map(
      server => ({
        name:
          server.name,
        url:
          server.url,
      }),
    ),
  );

  /*
   * También extraemos downloadsByQuality.
   */
  const downloads =
    extractDownloads(
      optionsHtml,
    );

  /*
   * Combinar.
   */
  const combined =
    [
      ...videoServers,
      ...downloads,
    ];

  /*
   * Deduplicar.
   */
  const unique:
    AnimeD23Server[] = [];

  const seen =
    new Set<string>();

  for (
    const server of combined
  ) {
    const key =
      server.url
        .trim()
        .toLowerCase();

    if (
      !key ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    unique.push(
      server,
    );
  }

  return sortServers(
    unique,
  );
}

/* ============================================================
 * BUSCAR PÁGINA /ANIME/
 * ========================================================== */

async function findAnimePage(
  slug: string,
): Promise<{
  url: string;
  html: string;
} | null> {
  for (
    const host of HOSTS
  ) {
    const url =
      `${host}/anime/${slug}/`;

    console.log(
      "🔎 AnimeD23 anime:",
      url,
    );

    const html =
      await fetchHtml(
        url,
      );

    if (
      html
    ) {
      console.log(
        "✅ AnimeD23 anime encontrado:",
        url,
      );

      return {
        url,
        html,
      };
    }
  }

  return null;
}

/* ============================================================
 * FUNCIÓN PRINCIPAL
 * ========================================================== */

export async function getAnimeD23Servers(
  slug: string,
  number: number,
): Promise<AnimeD23Server[]> {
  console.log(
    "================================================",
  );

  console.log(
    "🟣 ANIMED23",
  );

  console.log(
    "slug:",
    slug,
  );

  console.log(
    "episode:",
    number,
  );

  console.log(
    "================================================",
  );

  if (
    !slug ||
    !Number.isFinite(number) ||
    number < 1
  ) {
    return [];
  }

  const variants =
    generateSlugVariants(
      slug,
    );

  console.log(
    "🔎 AnimeD23 variantes:",
    variants,
  );

  /*
   * ==========================================================
   * MÉTODO 1
   *
   * Entrar a /anime/{slug}/ y leer sus enlaces reales.
   *
   * ESTA ES LA PARTE QUE FALTABA.
   * ==========================================================
   */

  for (
    const variant of variants
  ) {
    try {
      const animePage =
        await findAnimePage(
          variant,
        );

      if (
        !animePage
      ) {
        continue;
      }

      const episodes =
        extractEpisodeLinks(
          animePage.html,
        );

      console.log(
        "📚 AnimeD23 capítulos:",
        episodes.map(
          episode => ({
            slug:
              episode.slug,
            url:
              episode.url,
            text:
              episode.text,
          }),
        ),
      );

      const selected =
        selectEpisode(
          episodes,
          number,
          variant,
        );

      if (
        !selected
      ) {
        console.log(
          "⚠️ AnimeD23: no se pudo seleccionar episodio para:",
          variant,
        );

        continue;
      }

      console.log(
        "🎯 AnimeD23 capítulo seleccionado:",
        selected.url,
      );

      const servers =
        await getEpisodePlayer(
          selected.url,
        );

      if (
        servers.length
      ) {
        console.log(
          "✅ AnimeD23 servidores encontrados:",
          servers,
        );

        return servers;
      }
    } catch (error) {
      console.log(
        "⚠️ AnimeD23 variante fallida:",
        variant,
        error,
      );
    }
  }

  /*
   * ==========================================================
   * MÉTODO 2
   *
   * Fallback directo.
   *
   * Solo para estructuras convencionales.
   * ==========================================================
   */

  for (
    const variant of variants
  ) {
    for (
      const host of HOSTS
    ) {
      const directUrls = [
        `${host}/capitulo/${variant}-ep-${number}/`,
        `${host}/capitulo/${variant}-episodio-${number}/`,
        `${host}/capitulo/${variant}-episode-${number}/`,
        `${host}/capitulo/${variant}-${number}/`,
      ];

      /*
       * No intentamos automáticamente -2026
       * para cualquier anime porque podría generar
       * falsos positivos.
       *
       * Las películas se descubren mediante
       * /anime/{slug}/ en el método 1.
       */

      for (
        const episodeUrl of directUrls
      ) {
        try {
          const servers =
            await getEpisodePlayer(
              episodeUrl,
            );

          if (
            servers.length
          ) {
            return servers;
          }
        } catch {
          continue;
        }
      }
    }
  }

  console.log(
    "❌ AnimeD23: no se encontraron servidores",
  );

  return [];
}
