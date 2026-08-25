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

const PROVIDER_RULES: Array<{
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
    name: "MP4Upload",
    pattern: /mp4upload\.com/i,
  },
  {
    name: "Zilla",
    pattern: /zilla-networks\.com/i,
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
    name: "GoFile",
    pattern: /gofile\.io/i,
  },
  {
    name: "MediaFire",
    pattern: /mediafire\.com/i,
  },
  {
    name: "FireLoad",
    pattern: /fireload/i,
  },
  {
    name: "Tera",
    pattern: /terabox/i,
  },
];

/* ============================================================
 * NORMALIZACIÓN
 * ========================================================== */

function decodeHtml(
  value: string,
): string {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/gi, "/")
    .replace(/&nbsp;/gi, " ")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .trim();
}

function normalizeSource(
  value: string,
): string {
  return decodeHtml(value)
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/");
}

function normalizeTitle(
  value: string,
): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(/&/g, " and ")
    .replace(
      /[^a-z0-9\s-]/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function slugify(
  value: string,
): string {
  return normalizeTitle(value)
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

/* ============================================================
 * VARIANTES DE SLUG
 * ========================================================== */

function generateSlugVariants(
  value: string,
): string[] {
  const base =
    slugify(value);

  if (!base) {
    return [];
  }

  const result =
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
      result.add(clean);
    }
  };

  add(base);

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
    add(`${title}-${number}-season`);
    add(`${title}-${number}th-season`);
    add(`${title}-season-${number}`);
    add(`${title}-temporada-${number}`);
  }

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
    add(`${title}-${number}-season`);
    add(`${title}-${number}th-season`);
    add(`${title}-season-${number}`);
    add(`${title}-temporada-${number}`);
  }

  add(
    base.replace(
      /-(?:19|20)\d{2}$/,
      "",
    ),
  );

  add(
    base.replace(
      /-(?:temporada|season|part|parte|cour|t)-?\d+$/i,
      "",
    ),
  );

  if (
    base.endsWith(
      "-movie",
    )
  ) {
    add(
      base.replace(
        /-movie$/,
        "",
      ),
    );
  }

  return [
    ...result,
  ].slice(
    0,
    50,
  );
}

/* ============================================================
 * EPISODIOS
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

function extractEpisodeLinks(
  html: string,
): EpisodeLink[] {
  const result:
    EpisodeLink[] = [];

  const seen =
    new Set<string>();

  const addUrl = (
    rawUrl: string,
    text = "",
  ) => {
    let url =
      normalizeSource(
        rawUrl,
      ).trim();

    if (!url) {
      return;
    }

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
        url,
        slug:
          parts[index + 1],
        text:
          decodeHtml(
            text
              .replace(
                /<[^>]+>/g,
                " ",
              )
              .replace(
                /\s+/g,
                " ",
              )
              .trim(),
          ),
      });
    } catch {
      // URL inválida
    }
  };

  const hrefRegex =
    /<a\b[^>]*href\s*=\s*["']([^"']*\/capitulo\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match:
    RegExpExecArray | null;

  while (
    (match =
      hrefRegex.exec(
        html,
      )) !== null
  ) {
    addUrl(
      match[1],
      match[2],
    );
  }

  const rawRegex =
    /https?:\/\/animed23\.(?:com|online)\/capitulo\/[A-Za-z0-9%._~:/?#\[\]@!$&()*+,;=\-\\]+/gi;

  while (
    (match =
      rawRegex.exec(
        html,
      )) !== null
  ) {
    addUrl(
      match[0],
      match[0],
    );
  }

  return result;
}

function selectEpisode(
  episodes: EpisodeLink[],
  number: number,
  animeSlug: string,
): EpisodeLink | null {
  if (
    !episodes.length
  ) {
    return null;
  }

  for (
    const episode of episodes
  ) {
    if (
      extractEpisodeNumber(
        `${episode.slug} ${episode.text}`,
      ) === number
    ) {
      return episode;
    }
  }

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

  if (
    episodes.length === 1
  ) {
    return episodes[0];
  }

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
 * URLS
 * ========================================================== */

function extractUrlCandidates(
  html: string,
  pattern: RegExp,
): string[] {
  const source =
    normalizeSource(html);

  const result:
    string[] = [];

  const seen =
    new Set<string>();

  let match:
    RegExpExecArray | null;

  while (
    (match =
      pattern.exec(
        source,
      )) !== null
  ) {
    const url =
      decodeHtml(
        match[0],
      )
        .replace(
          /["'<>),;]+$/g,
          "",
        )
        .trim();

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
    result.push(url);
  }

  return result;
}

/* ============================================================
 * PASO 1:
 *
 * /opciones/player.php?data=...
 * ========================================================== */

function extractPlayerUrl(
  html: string,
): string | null {
  const source =
    normalizeSource(html);

  const patterns = [
    /https?:\/\/animed23\.(?:com|online)\/opciones\/player\.php\?data=[^"'<>\\\s]+/gi,
    /\/opciones\/player\.php\?data=[^"'<>\\\s]+/gi,
  ];

  for (
    const pattern of patterns
  ) {
    const urls =
      extractUrlCandidates(
        source,
        pattern,
      );

    if (
      urls[0]
    ) {
      return /^https?:\/\//i.test(
        urls[0],
      )
        ? urls[0]
        : `${HOSTS[0]}${
            urls[0].startsWith("/")
              ? ""
              : "/"
          }${urls[0]}`;
    }
  }

  return null;
}

/* ============================================================
 * PASO 2:
 *
 * /multiplayer/contenedor.php?id=...
 * ========================================================== */

function extractContainerUrl(
  html: string,
): string | null {
  const source =
    normalizeSource(html);

  const patterns = [
    /https?:\/\/animed23\.(?:com|online)\/multiplayer\/contenedor\.php\?id=[^"'<>\\\s]+/gi,
    /\/multiplayer\/contenedor\.php\?id=[^"'<>\\\s]+/gi,
  ];

  for (
    const pattern of patterns
  ) {
    const urls =
      extractUrlCandidates(
        source,
        pattern,
      );

    if (
      urls[0]
    ) {
      return /^https?:\/\//i.test(
        urls[0],
      )
        ? urls[0]
        : `${HOSTS[0]}${urls[0]}`;
    }
  }

  return null;
}

/* ============================================================
 * NOMBRE DEL SERVIDOR
 * ========================================================== */

function providerName(
  url: string,
): string {
  for (
    const rule of PROVIDER_RULES
  ) {
    if (
      rule.pattern.test(url)
    ) {
      return rule.name;
    }
  }

  return "AnimeD23";
}

function classifyUrl(
  url: string,
): "iframe" | "mp4" {
  return /\.(?:mp4|m3u8)(?:$|[?#])/i.test(
    url,
  )
    ? "mp4"
    : "iframe";
}

/* ============================================================
 * EXTRAER SERVIDORES DEL CONTENEDOR
 *
 * No dependemos de:
 *
 * const videoTabs = [...]
 *
 * porque en algunas versiones los tabs están vacíos
 * y las URLs aparecen en iframe, data-src, scripts,
 * objetos JS o HTML escapado.
 * ========================================================== */

function extractProviderUrls(
  html: string,
): AnimeD23Server[] {
  const source =
    normalizeSource(html);

  const found:
    AnimeD23Server[] = [];

  const seen =
    new Set<string>();

  const patterns = [
    /https?:\/\/(?:www\.)?(?:bysesukior\.com|mytsumi\.com|mega\.nz|archive\.org|mp4upload\.com|player\.zilla-networks\.com|ok\.ru|ytplay[^/"'<> ]*|abyssplayer[^/"'<> ]*|gofile\.io|mediafire\.com|fireload[^/"'<> ]*|terabox[^/"'<> ]*)[^"'<>\\\s]*/gi,

    /https?:\/\/(?:www\.)?bysesukior\.com\/e\/[A-Za-z0-9_-]+/gi,

    /https?:\/\/(?:www\.)?mytsumi\.com\/multiplayer\/play2026\/player\.php\?data=[^"'<>\\\s]+/gi,

    /https?:\/\/(?:www\.)?mp4upload\.com\/embed-[A-Za-z0-9]+\.html/gi,

    /https?:\/\/(?:www\.)?mega\.nz\/(?:embed|file)\/[^"'<>\\\s]+/gi,

    /https?:\/\/(?:www\.)?archive\.org\/[^"'<>\\\s]+/gi,

    /https?:\/\/player\.zilla-networks\.com\/play\/[A-Za-z0-9_-]+/gi,
  ];

  for (
    const pattern of patterns
  ) {
    for (
      const rawUrl of
        extractUrlCandidates(
          source,
          pattern,
        )
    ) {
      let clean =
        rawUrl
          .replace(
            /\\u0026/gi,
            "&",
          )
          .replace(
            /\\u003d/gi,
            "=",
          );

      clean =
        clean.replace(
          /[)"'<>]+$/g,
          "",
        );

      if (
        !/^https?:\/\//i.test(
          clean,
        )
      ) {
        continue;
      }

      const key =
        clean
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

      found.push({
        name:
          providerName(clean),
        url:
          clean,
        type:
          classifyUrl(clean),
      });
    }
  }

  return found;
}

/* ============================================================
 * FETCH RAW
 *
 * Para player.php y contenedor.php usamos fetch directo.
 * No pasamos por validaciones que podrían descartar
 * documentos pequeños/embebidos.
 * ========================================================== */

async function fetchRawHtml(
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

    if (
      referer
    ) {
      headers.Referer =
        referer;
    }

    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          headers,

          redirect:
            "follow",
        },
      );

    if (
      !response.ok
    ) {
      console.log(
        "⚠️ AnimeD23 HTTP",
        response.status,
        url,
      );

      return null;
    }

    return await response.text();
  } catch (error) {
    console.log(
      "⚠️ AnimeD23 fetch",
      url,
      error,
    );

    return null;
  }
}

/* ============================================================
 * OBTENER SERVIDORES DEL CAPÍTULO
 *
 * FLUJO REAL:
 *
 * capítulo
 *   ↓
 * player.php?data=...
 *   ↓
 * multiplayer/contenedor.php?id=...
 *   ↓
 * iframes / scripts / providers
 * ========================================================== */

async function getEpisodePlayer(
  episodeUrl: string,
): Promise<AnimeD23Server[]> {
  console.log(
    "🎬 AnimeD23 episodio:",
    episodeUrl,
  );

  const episodeHtml =
    await fetchRawHtml(
      episodeUrl,
    );

  if (
    !episodeHtml
  ) {
    return [];
  }

  /*
   * ----------------------------------------------------------
   * 1. PLAYER.PHP
   * ----------------------------------------------------------
   */

  const playerUrl =
    extractPlayerUrl(
      episodeHtml,
    );

  if (
    !playerUrl
  ) {
    console.log(
      "⚠️ AnimeD23: no se encontró player.php?data=",
    );

    /*
     * Algunas plantillas pueden poner el contenedor
     * directamente.
     */
    const directContainer =
      extractContainerUrl(
        episodeHtml,
      );

    if (
      directContainer
    ) {
      const containerHtml =
        await fetchRawHtml(
          directContainer,
          episodeUrl,
        );

      return containerHtml
        ? extractProviderUrls(
            containerHtml,
          )
        : [];
    }

    /*
     * Último fallback:
     * intentar encontrar servidores directamente
     * en el HTML del capítulo.
     */
    return extractProviderUrls(
      episodeHtml,
    );
  }

  console.log(
    "🔗 AnimeD23 player.php:",
    playerUrl,
  );

  /*
   * ----------------------------------------------------------
   * 2. ENTRAR A PLAYER.PHP
   * ----------------------------------------------------------
   */

  const playerHtml =
    await fetchRawHtml(
      playerUrl,
      episodeUrl,
    );

  if (
    !playerHtml
  ) {
    return [];
  }

  /*
   * ----------------------------------------------------------
   * 3. EXTRAER CONTENEDOR
   * ----------------------------------------------------------
   */

  const containerUrl =
    extractContainerUrl(
      playerHtml,
    );

  if (
    !containerUrl
  ) {
    console.log(
      "⚠️ AnimeD23: no se encontró contenedor.php",
    );

    return extractProviderUrls(
      playerHtml,
    );
  }

  console.log(
    "🔗 AnimeD23 contenedor.php:",
    containerUrl,
  );

  /*
   * ----------------------------------------------------------
   * 4. ENTRAR AL CONTENEDOR
   * ----------------------------------------------------------
   */

  const containerHtml =
    await fetchRawHtml(
      containerUrl,
      playerUrl,
    );

  if (
    !containerHtml
  ) {
    return [];
  }

  /*
   * ----------------------------------------------------------
   * 5. EXTRAER TODOS LOS PROVIDERS
   * ----------------------------------------------------------
   */

  const servers =
    extractProviderUrls(
      containerHtml,
    );

  console.log(
    "🎥 AnimeD23 servers:",
    servers,
  );

  return servers;
}

/* ============================================================
 * BUSCAR /anime/{slug}/
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
      return {
        url,
        html,
      };
    }
  }

  return null;
}

/* ============================================================
 * ORDEN INTERNO DE ANIMED23
 * ========================================================== */

function sortServers(
  servers: AnimeD23Server[],
): AnimeD23Server[] {
  const priority =
    (
      server: AnimeD23Server,
    ): number => {
      const name =
        server.name.toLowerCase();

      /*
       * MP4Upload primero dentro de AnimeD23
       * porque getServers lo convertirá en Server 3.
       */
      if (
        name.includes(
          "mp4upload",
        )
      ) {
        return 0;
      }

      if (
        name.includes(
          "mytsumi",
        )
      ) {
        return 1;
      }

      if (
        name.includes(
          "mega",
        )
      ) {
        return 2;
      }

      if (
        name.includes(
          "archive",
        )
      ) {
        return 3;
      }

      if (
        name.includes(
          "zilla",
        )
      ) {
        return 4;
      }

      if (
        name.includes(
          "moon",
        )
      ) {
        return 5;
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
 * FUNCIÓN PÚBLICA
 * ========================================================== */

export async function getAnimeD23Servers(
  slug: string,
  number: number,
): Promise<AnimeD23Server[]> {
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

  /*
   * ----------------------------------------------------------
   * MÉTODO 1
   *
   * /anime/{slug}/
   * ----------------------------------------------------------
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

      const selected =
        selectEpisode(
          episodes,
          number,
          variant,
        );

      if (
        !selected
      ) {
        continue;
      }

      console.log(
        "🎯 AnimeD23 capítulo:",
        selected.url,
      );

      const servers =
        await getEpisodePlayer(
          selected.url,
        );

      if (
        servers.length
      ) {
        return sortServers(
          servers,
        );
      }
    } catch (error) {
      console.log(
        "⚠️ AnimeD23 candidato fallido:",
        variant,
        error,
      );
    }
  }

  /*
   * ----------------------------------------------------------
   * MÉTODO 2
   *
   * URLs directas de capítulos.
   * ----------------------------------------------------------
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
            return sortServers(
              servers,
            );
          }
        } catch {
          // siguiente URL
        }
      }
    }
  }

  console.log(
    "❌ AnimeD23: no se encontraron servidores",
  );

  return [];
}
