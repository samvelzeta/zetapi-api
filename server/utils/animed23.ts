import { fetchHtml, getHeaders } from "./fetcher";

export interface AnimeD23Server {
  name: string;
  url: string;
  type: "iframe" | "mp4";
}

interface EpisodeLink {
  url: string;
  slug: string;
  text: string;
}

const HOSTS = [
  "https://animed23.online",
  "https://animed23.com",
];

/* ============================================================
 * UTILIDADES
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
 * VARIANTES DE SLUG
 * ========================================================== */

function generateSlugVariants(value: string): string[] {
  const base = slugify(value);

  if (!base) {
    return [];
  }

  const result = new Set<string>();

  const add = (value: string) => {
    const clean = value
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (clean) {
      result.add(clean);
    }
  };

  add(base);

  /*
   * temporada-4
   */
  const seasonMatch = base.match(
    /^(.*?)-(?:temporada|season)-?(\d+)$/i,
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
   * Quitar sufijos de temporada.
   */
  add(
    base.replace(
      /-(?:season|temporada|part|parte|cour)-?\d+$/i,
      "",
    ),
  );

  /*
   * Películas.
   */
  if (base.endsWith("-movie")) {
    add(base.replace(/-movie$/, ""));
  }

  return [...result].slice(0, 40);
}

/* ============================================================
 * EXTRAER ARRAY JAVASCRIPT BALANCEADO
 *
 * Sirve para:
 *
 * const videoTabs = [...]
 *
 * No usamos una regex simple porque las URLs pueden contener
 * caracteres que rompen una expresión demasiado sencilla.
 * ========================================================== */

function extractBalancedArray(
  html: string,
  variableName: string,
): string | null {
  const marker = html.indexOf(variableName);

  if (marker < 0) {
    return null;
  }

  const start = html.indexOf(
    "[",
    marker + variableName.length,
  );

  if (start < 0) {
    return null;
  }

  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (
    let i = start;
    i < html.length;
    i++
  ) {
    const char = html[i];

    if (quote !== null) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === quote) {
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

    if (char === "[") {
      depth++;
      continue;
    }

    if (char === "]") {
      depth--;

      if (depth === 0) {
        return html.slice(
          start,
          i + 1,
        );
      }
    }
  }

  return null;
}

/* ============================================================
 * EXTRAER videoTabs
 *
 * El contenedor real de AnimeD23 contiene:
 *
 * const videoTabs = [
 *   {
 *     tab_name: "Moon",
 *     url: "..."
 *   },
 *   ...
 * ];
 * ========================================================== */

function extractVideoTabs(
  html: string,
): AnimeD23Server[] {
  const arrayText = extractBalancedArray(
    html,
    "videoTabs",
  );

  if (!arrayText) {
    console.log(
      "⚠️ AnimeD23: no se encontró videoTabs",
    );

    return [];
  }

  let tabs: any[];

  try {
    tabs = JSON.parse(
      arrayText,
    );
  } catch {
    try {
      tabs = JSON.parse(
        decodeHtml(arrayText),
      );
    } catch (error) {
      console.log(
        "❌ AnimeD23: videoTabs no es JSON válido",
        error,
      );

      return [];
    }
  }

  if (!Array.isArray(tabs)) {
    return [];
  }

  const result: AnimeD23Server[] = [];
  const seen = new Set<string>();

  for (const tab of tabs) {
    if (!tab) {
      continue;
    }

    let url = decodeHtml(
      String(
        tab.url ||
        tab.src ||
        tab.embed ||
        "",
      ),
    );

    if (!url) {
      continue;
    }

    if (
      !/^https?:\/\//i.test(url)
    ) {
      continue;
    }

    /*
     * No devolver páginas intermedias.
     */
    if (
      /\/opciones\/options\.php/i.test(url) ||
      /\/multiplayer\/contenedor\.php/i.test(url)
    ) {
      continue;
    }

    /*
     * El HTML real marca algunos servidores como active.
     * Si existe status y no está activo, no lo usamos.
     */
    if (
      tab.status &&
      String(tab.status).toLowerCase() !== "active"
    ) {
      continue;
    }

    const key = url
      .replace(/\/+$/, "")
      .toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    let name = String(
      tab.tab_name ||
      tab.name ||
      "",
    ).trim();

    if (!name) {
      name = detectServerName(url);
    }

    const type =
      /\.mp4(?:$|\?)/i.test(url)
        ? "mp4"
        : "iframe";

    result.push({
      name,
      url,
      type,
    });
  }

  return result;
}

/* ============================================================
 * NOMBRE DEL SERVIDOR
 * ========================================================== */

function detectServerName(
  url: string,
): string {
  const value = url.toLowerCase();

  if (
    value.includes("bysesukior")
  ) {
    return "Moon";
  }

  if (
    value.includes("mytsumi")
  ) {
    return "Mytsumi";
  }

  if (
    value.includes("mega.nz")
  ) {
    return "Mega";
  }

  if (
    value.includes("ok.ru")
  ) {
    return "OK";
  }

  if (
    value.includes("ytplay") ||
    value.includes("rpmvid")
  ) {
    return "Epsilon";
  }

  if (
    value.includes("abyssplayer")
  ) {
    return "Abyss";
  }

  return "Server";
}

/* ============================================================
 * PRIORIDAD
 *
 * AnimeD23 normalmente coloca Moon primero.
 *
 * No eliminamos servidores.
 * Solamente ordenamos.
 * ========================================================== */

function getPriority(
  server: AnimeD23Server,
): number {
  const name =
    server.name.toLowerCase();

  if (
    name.includes("moon") ||
    name.includes("bysesukior")
  ) {
    return 0;
  }

  if (
    name.includes("mytsumi")
  ) {
    return 1;
  }

  if (
    name.includes("mega")
  ) {
    return 2;
  }

  if (
    name === "ok" ||
    name.includes(" ok")
  ) {
    return 3;
  }

  if (
    name.includes("epsilon") ||
    name.includes("ytplay")
  ) {
    return 4;
  }

  if (
    name.includes("abyss")
  ) {
    return 5;
  }

  return 20;
}

/* ============================================================
 * EXTRAER contenedor.php
 *
 * Puede aparecer:
 *
 * https://animed23.online/multiplayer/contenedor.php?id=XXXX
 *
 * o dentro de un iframe.
 * ========================================================== */

function extractContainerUrls(
  html: string,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const add = (
    value: string,
  ) => {
    let url = decodeHtml(
      value,
    );

    if (
      !url
    ) {
      return;
    }

    if (
      !/^https?:\/\//i.test(url)
    ) {
      if (url.startsWith("/")) {
        url =
          `https://animed23.online${url}`;
      } else {
        url =
          `https://animed23.online/${url}`;
      }
    }

    if (
      !/\/multiplayer\/contenedor\.php\?id=/i.test(
        url,
      )
    ) {
      return;
    }

    if (
      !seen.has(url)
    ) {
      seen.add(url);
      result.push(url);
    }
  };

  /*
   * URL completa.
   */
  const absoluteRegex =
    /https?:\/\/animed23\.(?:com|online)\/multiplayer\/contenedor\.php\?id=[^"'<>\\\s]+/gi;

  let match: RegExpExecArray | null;

  while (
    (match = absoluteRegex.exec(html)) !== null
  ) {
    add(match[0]);
  }

  /*
   * src="..."
   */
  const srcRegex =
    /<iframe\b[^>]*src\s*=\s*["']([^"']*\/multiplayer\/contenedor\.php\?id=[^"']+)["']/gi;

  while (
    (match = srcRegex.exec(html)) !== null
  ) {
    add(match[1]);
  }

  /*
   * src='...'
   */
  const genericRegex =
    /(?:src|href)\s*=\s*["']([^"']*contenedor\.php\?id=[^"']+)["']/gi;

  while (
    (match = genericRegex.exec(html)) !== null
  ) {
    add(match[1]);
  }

  return result;
}

/* ============================================================
 * EXTRAER options.php
 *
 * Algunas versiones de AnimeD23 pasan primero por:
 *
 * /opciones/options.php?server=multi&value=...
 *
 * Si encontramos eso, también lo seguimos.
 * ========================================================== */

function extractOptionsUrls(
  html: string,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const add = (
    value: string,
  ) => {
    let url = decodeHtml(
      value,
    );

    if (
      !url
    ) {
      return;
    }

    if (
      !/^https?:\/\//i.test(url)
    ) {
      if (url.startsWith("/")) {
        url =
          `https://animed23.online${url}`;
      } else {
        url =
          `https://animed23.online/${url}`;
      }
    }

    if (
      !/\/opciones\/options\.php\?/i.test(
        url,
      )
    ) {
      return;
    }

    if (
      !seen.has(url)
    ) {
      seen.add(url);
      result.push(url);
    }
  };

  const absoluteRegex =
    /https?:\/\/animed23\.(?:com|online)\/opciones\/options\.php\?[^"'<>\\\s]+/gi;

  let match: RegExpExecArray | null;

  while (
    (match = absoluteRegex.exec(html)) !== null
  ) {
    add(match[0]);
  }

  const srcRegex =
    /<iframe\b[^>]*src\s*=\s*["']([^"']*options\.php\?[^"']+)["']/gi;

  while (
    (match = srcRegex.exec(html)) !== null
  ) {
    add(match[1]);
  }

  return result;
}

/* ============================================================
 * EXTRAER ENLACES DE CAPÍTULOS
 * ========================================================== */

function extractEpisodeLinks(
  html: string,
): EpisodeLink[] {
  const result: EpisodeLink[] = [];
  const seen = new Set<string>();

  const regex =
    /<a\b[^>]*href\s*=\s*["']([^"']*\/capitulo\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while (
    (match = regex.exec(html)) !== null
  ) {
    let url = decodeHtml(
      match[1],
    );

    if (
      !/^https?:\/\//i.test(url)
    ) {
      if (url.startsWith("/")) {
        url =
          `https://animed23.online${url}`;
      } else {
        url =
          `https://animed23.online/${url}`;
      }
    }

    const text = decodeHtml(
      match[2]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );

    try {
      const parsed = new URL(
        url,
      );

      const parts =
        parsed.pathname
          .split("/")
          .filter(Boolean);

      const index =
        parts.findIndex(
          value =>
            value.toLowerCase() ===
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
        text,
      });
    } catch {
      continue;
    }
  }

  return result;
}

/* ============================================================
 * DETERMINAR SI UN ENLACE ES EL EPISODIO BUSCADO
 * ========================================================== */

function episodeMatches(
  episode: EpisodeLink,
  number: number,
): boolean {
  const value =
    `${episode.slug} ${episode.text}`
      .toLowerCase();

  const n = String(number);

  /*
   * Casos:
   *
   * -ep-9
   * -episodio-9
   * -episode-9
   * ep 9
   * episodio 9
   */
  const patterns = [
    new RegExp(
      `(?:^|[-_\\s])ep(?:isode|isodio)?[-_\\s]*${n}(?:$|[-_\\s])`,
      "i",
    ),

    new RegExp(
      `(?:^|[-_\\s])episodio[-_\\s]*${n}(?:$|[-_\\s])`,
      "i",
    ),

    new RegExp(
      `(?:^|[-_\\s])episode[-_\\s]*${n}(?:$|[-_\\s])`,
      "i",
    ),
  ];

  return patterns.some(
    pattern =>
      pattern.test(value),
  );
}

/* ============================================================
 * EXTRAER URL DE UNA PÁGINA DE EPISODIO
 * ========================================================== */

async function extractEpisodePlayers(
  episodeUrl: string,
): Promise<AnimeD23Server[]> {
  console.log(
    "🎬 AnimeD23 episodio:",
    episodeUrl,
  );

  const html =
    await fetchHtml(
      episodeUrl,
    );

  if (!html) {
    console.log(
      "⚠️ AnimeD23 episodio sin HTML:",
      episodeUrl,
    );

    return [];
  }

  /*
   * PRIMERA VÍA:
   *
   * El iframe contenedor.php.
   */
  const containers =
    extractContainerUrls(
      html,
    );

  /*
   * SEGUNDA VÍA:
   *
   * options.php.
   */
  const options =
    extractOptionsUrls(
      html,
    );

  console.log(
    "🔎 AnimeD23 containers:",
    containers.length,
  );

  console.log(
    "🔎 AnimeD23 options:",
    options.length,
  );

  const pages = [
    ...containers,
    ...options,
  ];

  /*
   * También intentamos buscar directamente
   * videoTabs por si la página ya contiene
   * el objeto.
   */
  const directTabs =
    extractVideoTabs(
      html,
    );

  if (
    directTabs.length
  ) {
    console.log(
      "✅ AnimeD23 videoTabs directo:",
      directTabs.length,
    );

    return sortServers(
      directTabs,
    );
  }

  const allServers: AnimeD23Server[] = [];
  const seen = new Set<string>();

  /*
   * Seguir cada contenedor/options.
   */
  for (
    const playerPage of pages
  ) {
    try {
      console.log(
        "🔎 AnimeD23 leyendo:",
        playerPage,
      );

      const playerHtml =
        await fetchHtml(
          playerPage,
        );

      if (!playerHtml) {
        continue;
      }

      /*
       * AQUÍ está la parte importante:
       *
       * const videoTabs = [...]
       */
      const servers =
        extractVideoTabs(
          playerHtml,
        );

      for (
        const server of servers
      ) {
        const key =
          server.url
            .toLowerCase()
            .replace(/\/+$/, "");

        if (
          seen.has(key)
        ) {
          continue;
        }

        seen.add(key);
        allServers.push(
          server,
        );
      }

      /*
       * Puede ocurrir que options.php
       * devuelva un contenedor adicional.
       */
      const nestedContainers =
        extractContainerUrls(
          playerHtml,
        );

      for (
        const nested of nestedContainers
      ) {
        if (
          pages.includes(nested)
        ) {
          continue;
        }

        try {
          const nestedHtml =
            await fetchHtml(
              nested,
            );

          if (!nestedHtml) {
            continue;
          }

          const nestedServers =
            extractVideoTabs(
              nestedHtml,
            );

          for (
            const server of nestedServers
          ) {
            const key =
              server.url
                .toLowerCase()
                .replace(/\/+$/, "");

            if (
              seen.has(key)
            ) {
              continue;
            }

            seen.add(key);
            allServers.push(
              server,
            );
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.log(
        "⚠️ AnimeD23 player error:",
        error,
      );
    }
  }

  return sortServers(
    allServers,
  );
}

/* ============================================================
 * ORDENAR SERVIDORES
 * ========================================================== */

function sortServers(
  servers: AnimeD23Server[],
): AnimeD23Server[] {
  return [...servers].sort(
    (a, b) =>
      getPriority(a) -
      getPriority(b),
  );
}

/* ============================================================
 * BUSCAR PÁGINA DE ANIME
 * ========================================================== */

async function findAnimePage(
  slug: string,
): Promise<{
  host: string;
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
        host,
        html,
      };
    }
  }

  return null;
}

/* ============================================================
 * OBTENER SERVIDORES
 *
 * Esta es la función que utiliza getServers.ts:
 *
 * getAnimeD23Servers(slug, number)
 * ========================================================== */

export async function getAnimeD23Servers(
  slug: string,
  number: number,
): Promise<AnimeD23Server[]> {
  console.log(
    "================================================",
  );

  console.log(
    "🟣 ANIMED23 SCRAPER",
  );

  console.log(
    "================================================",
  );

  if (
    !slug ||
    !Number.isFinite(number) ||
    number < 1
  ) {
    console.log(
      "❌ AnimeD23 parámetros inválidos",
    );

    return [];
  }

  /*
   * ==========================================================
   * PASO 1
   *
   * Probar directamente las variantes del slug.
   * ==========================================================
   */

  const slugVariants =
    generateSlugVariants(
      slug,
    );

  console.log(
    "🔎 AnimeD23 slugs:",
    slugVariants,
  );

  /*
   * ==========================================================
   * PASO 2
   *
   * Primero intentamos encontrar una página /anime/.
   * ==========================================================
   */

  for (
    const candidate of slugVariants
  ) {
    try {
      const animePage =
        await findAnimePage(
          candidate,
        );

      if (!animePage) {
        continue;
      }

      console.log(
        "✅ AnimeD23 anime encontrado:",
        candidate,
      );

      /*
       * Buscar enlaces de episodios.
       */
      const episodes =
        extractEpisodeLinks(
          animePage.html,
        );

      console.log(
        "📚 AnimeD23 episodios encontrados:",
        episodes.length,
      );

      /*
       * Buscar el episodio exacto.
       */
      const matchingEpisodes =
        episodes.filter(
          episode =>
            episodeMatches(
              episode,
              number,
            ),
        );

      /*
       * Si el texto no permitió identificarlo,
       * intentamos por slug.
       */
      let targets =
        matchingEpisodes;

      if (
        !targets.length
      ) {
        targets =
          episodes.filter(
            episode =>
              new RegExp(
                `(?:-|_)${number}(?:-|_|$)`,
                "i",
              ).test(
                episode.slug,
              ),
          );
      }

      /*
       * Limitar para no hacer demasiadas
       * solicitudes inútiles.
       */
      targets =
        targets.slice(
          0,
          5,
        );

      console.log(
        "🎯 AnimeD23 episodios candidatos:",
        targets.map(
          episode =>
            episode.url,
        ),
      );

      for (
        const episode of targets
      ) {
        const servers =
          await extractEpisodePlayers(
            episode.url,
          );

        if (
          servers.length
        ) {
          console.log(
            "✅ AnimeD23 servidores:",
            servers.map(
              server => ({
                name: server.name,
                type: server.type,
                url: server.url,
              }),
            ),
          );

          return servers;
        }
      }

      /*
       * ======================================================
       * FALLBACK:
       *
       * Puede que la página /anime/ no tenga la lista
       * de episodios completa.
       *
       * Probamos directamente las rutas conocidas.
       * ======================================================
       */

      const directUrls = [
        `${animePage.host}/capitulo/${candidate}-ep-${number}/`,
        `${animePage.host}/capitulo/${candidate}-episodio-${number}/`,
        `${animePage.host}/capitulo/${candidate}-episode-${number}/`,
      ];

      for (
        const directUrl of directUrls
      ) {
        const servers =
          await extractEpisodePlayers(
            directUrl,
          );

        if (
          servers.length
        ) {
          console.log(
            "✅ AnimeD23 directo:",
            directUrl,
          );

          return servers;
        }
      }
    } catch (error) {
      console.log(
        "⚠️ AnimeD23 candidato fallido:",
        candidate,
        error,
      );
    }
  }

  /*
   * ==========================================================
   * PASO 3
   *
   * Si ninguna página /anime/ funcionó,
   * probar directamente ambas bases.
   * ==========================================================
   */

  for (
    const candidate of slugVariants
  ) {
    for (
      const host of HOSTS
    ) {
      const directUrls = [
        `${host}/capitulo/${candidate}-ep-${number}/`,
        `${host}/capitulo/${candidate}-episodio-${number}/`,
        `${host}/capitulo/${candidate}-episode-${number}/`,
      ];

      for (
        const directUrl of directUrls
      ) {
        try {
          const servers =
            await extractEpisodePlayers(
              directUrl,
            );

          if (
            servers.length
          ) {
            console.log(
              "✅ AnimeD23 encontrado por ruta directa:",
              directUrl,
            );

            return servers;
          }
        } catch (error) {
          console.log(
            "⚠️ AnimeD23 ruta fallida:",
            directUrl,
            error,
          );
        }
      }
    }
  }

  console.log(
    "❌ AnimeD23 no encontró servidores",
  );

  return [];
}
