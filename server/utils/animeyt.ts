import { fetchHtml } from "./fetcher";

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
  const query =
    `${slug} capitulo ${episode}`;

  const searchUrls = [
    `https://animeyt.cc/?s=${encodeURIComponent(
      query,
    )}`,
    `https://animeyt.cc/?s=${encodeURIComponent(
      slug,
    )}`,
  ];

  for (const searchUrl of searchUrls) {
    try {
      const html =
        await fetchHtml(searchUrl);

      if (!html) {
        continue;
      }

      /*
       * Buscamos enlaces de episodios.
       */
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
          `capitulo-${episode}`;

        if (
          lower.includes(
            wanted,
          )
        ) {
          return candidate;
        }
      }
    } catch (error) {
      console.log(
        `⚠️ AnimeYT búsqueda error: ${searchUrl}`,
        error,
      );
    }
  }

  /*
   * Fallback directo.
   *
   * Puede que la URL no tenga ID; la dejamos
   * como último intento.
   */
  return buildDirectEpisodeUrl(
    slug,
    episode,
  );
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

  console.log(
    `🔍 AnimeYT: buscando "${normalizedSlug}" episodio ${normalizedEpisode}`,
  );

  /*
   * 1. Obtener URL real del episodio.
   */
  const episodeUrl =
    await findEpisodeUrl(
      normalizedSlug,
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
