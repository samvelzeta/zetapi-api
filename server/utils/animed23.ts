import { fetchHtml, getHeaders } from "./fetcher";

export interface AnimeD23Server {
  name: string;
  url: string;
  type: "iframe" | "mp4";
}

interface AnimeD23EpisodeLink {
  url: string;
  slug: string;
  text: string;
}

const HOSTS = [
  "https://animed23.com",
  "https://animed23.online",
];

const SERVER_PRIORITY: Record<string, number> = {
  moon: 0,
  bysesukior: 0,
  mytsumi: 1,
  mega: 2,
  ok: 3,
  epsilon: 4,
  ytplay: 4,
  abyss: 5,
};

function cleanHtml(value: string): string {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/")
    .replace(/\s+/g, " ")
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

/**
 * Genera muchas variantes porque AnimeD23 no mantiene
 * siempre el mismo formato entre la página /anime/
 * y la página /capitulo/.
 */
function generateSlugVariants(
  title: string,
): string[] {
  const base = slugify(title);

  if (!base) {
    return [];
  }

  const variants = new Set<string>();

  const add = (value: string) => {
    const clean = value
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (clean) {
      variants.add(clean);
    }
  };

  add(base);

  /*
   * Temporadas:
   *
   * temporada-4
   * season-4
   * 4th-season
   * 4-season
   */
  const seasonMatch = base.match(
    /(?:^|-)(?:temporada|season)-?(\d+)$/,
  );

  if (seasonMatch) {
    const number = seasonMatch[1];

    const withoutSeason = base.replace(
      /-(?:temporada|season)-?\d+$/,
      "",
    );

    add(withoutSeason);
    add(`${withoutSeason}-${number}-season`);
    add(`${withoutSeason}-${number}th-season`);
    add(`${withoutSeason}-season-${number}`);
    add(`${withoutSeason}-temporada-${number}`);
  }

  /*
   * Formatos tipo:
   *
   * title-4th-season
   * title-4-season
   */
  const ordinalMatch = base.match(
    /-(\d+)(?:st|nd|rd|th)?-season$/,
  );

  if (ordinalMatch) {
    const number = ordinalMatch[1];

    const withoutSeason = base.replace(
      /-\d+(?:st|nd|rd|th)?-season$/,
      "",
    );

    add(withoutSeason);
    add(`${withoutSeason}-${number}-season`);
    add(`${withoutSeason}-${number}th-season`);
    add(`${withoutSeason}-temporada-${number}`);
  }

  /*
   * El año suele aparecer únicamente en
   * el slug del capítulo.
   */
  const withoutYear = base.replace(
    /-(?:19|20)\d{2}$/,
    "",
  );

  add(withoutYear);

  /*
   * Elimina "movie", "film", etc. solamente
   * como variantes adicionales, nunca elimina
   * la original.
   */
  if (base.endsWith("-movie")) {
    add(base.replace(/-movie$/, ""));
  }

  /*
   * Variantes sin sufijos de temporada.
   */
  add(
    base.replace(
      /-(?:temporada|season|part|parte|cour)-?\d+$/,
      "",
    ),
  );

  return [...variants].slice(0, 20);
}

/**
 * Extrae un array balanceado después de un marcador.
 *
 * Esto es mucho más seguro que:
 *
 * /\[.*?\]/
 *
 * porque videoTabs contiene URLs y objetos.
 */
function extractBalancedArray(
  text: string,
  marker: string,
): string | null {
  const markerIndex = text.indexOf(marker);

  if (markerIndex < 0) {
    return null;
  }

  const start = text.indexOf(
    "[",
    markerIndex + marker.length,
  );

  if (start < 0) {
    return null;
  }

  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (
    let i = start;
    i < text.length;
    i++
  ) {
    const char = text[i];

    if (quote) {
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
 * Extrae directamente:
 *
 * const videoTabs = [...]
 *
 * del contenedor.php.
 */
function extractVideoTabs(
  html: string,
): AnimeD23Server[] {
  const arrayText =
    extractBalancedArray(
      html,
      "videoTabs",
    );

  if (!arrayText) {
    return [];
  }

  let tabs: any[];

  try {
    /*
     * El contenido viene como JSON válido,
     * aunque las barras estén escapadas.
     */
    tabs = JSON.parse(arrayText);
  } catch {
    /*
     * Segundo intento limpiando algunas
     * secuencias generadas por PHP.
     */
    try {
      const repaired = arrayText
        .replace(/\\\//g, "/")
        .replace(/&quot;/gi, '"')
        .replace(/&amp;/gi, "&");

      tabs = JSON.parse(repaired);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(tabs)) {
    return [];
  }

  const result: AnimeD23Server[] = [];
  const seen = new Set<string>();

  for (const tab of tabs) {
    const rawUrl = String(
      tab?.url || "",
    )
      .replace(/\\\//g, "/")
      .replace(/\\u0026/gi, "&")
      .trim();

    if (
      !/^https?:\/\//i.test(rawUrl)
    ) {
      continue;
    }

    if (
      rawUrl === "about:blank"
    ) {
      continue;
    }

    /*
     * No queremos devolver nuevamente
     * options.php o contenedor.php.
     */
    if (
      /\/opciones\/options\.php/i.test(
        rawUrl,
      ) ||
      /\/multiplayer\/contenedor\.php/i.test(
        rawUrl,
      )
    ) {
      continue;
    }

    const name = String(
      tab?.tab_name ||
        tab?.name ||
        "",
    ).trim();

    const key =
      rawUrl
        .replace(/\/+$/, "")
        .toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    result.push({
      name:
        name ||
        detectServerName(rawUrl),
      url: rawUrl,
      type: rawUrl
        .toLowerCase()
        .endsWith(".mp4")
        ? "mp4"
        : "iframe",
    });
  }

  result.sort(
    (a, b) =>
      getServerPriority(a) -
      getServerPriority(b),
  );

  return result;
}

function detectServerName(
  url: string,
): string {
  const lower =
    url.toLowerCase();

  if (
    lower.includes(
      "bysesukior",
    )
  ) {
    return "Moon";
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
      "mega.nz",
    )
  ) {
    return "Mega";
  }

  if (
    lower.includes(
      "ok.ru",
    )
  ) {
    return "OK";
  }

  if (
    lower.includes(
      "ytplay",
    )
  ) {
    return "Epsilon";
  }

  if (
    lower.includes(
      "abyssplayer",
    )
  ) {
    return "Abyss";
  }

  return "Externo";
}

function getServerPriority(
  server: AnimeD23Server,
): number {
  const name =
    server.name.toLowerCase();

  for (
    const key of Object.keys(
      SERVER_PRIORITY,
    )
  ) {
    if (
      name.includes(key)
    ) {
      return SERVER_PRIORITY[key];
    }
  }

  return 50;
}

/**
 * Busca URLs de options.php.
 */
function extractOptionsUrls(
  html: string,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const regex =
    /https?:\/\/animed23\.(?:com|online)\/opciones\/options\.php\?server=multi&value=[^"'<>\\s]+/gi;

  let match: RegExpExecArray | null;

  while (
    (match = regex.exec(html)) !== null
  ) {
    let url = match[0];

    url = url
      .replace(/&amp;/gi, "&")
      .replace(/\\\//g, "/")
      .trim();

    if (
      !seen.has(url)
    ) {
      seen.add(url);
      result.push(url);
    }
  }

  /*
   * Fallback para src="..."
   */
  const srcRegex =
    /<iframe\b[^>]*src=["']([^"']*options\.php\?server=multi[^"']*)["']/gi;

  while (
    (match = srcRegex.exec(html)) !== null
  ) {
    let url =
      match[1]
        .replace(/&amp;/gi, "&")
        .replace(/\\\//g, "/")
        .trim();

    if (
      !/^https?:\/\//i.test(url)
    ) {
      url =
        `https://animed23.online${url.startsWith("/") ? "" : "/"}${url}`;
    }

    if (
      !seen.has(url)
    ) {
      seen.add(url);
      result.push(url);
    }
  }

  return result;
}

/**
 * Extrae contenedor.php directamente.
 */
function extractContainerUrls(
  html: string,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const regex =
    /https?:\/\/animed23\.online\/multiplayer\/contenedor\.php\?id=[^"'<>\\s]+/gi;

  let match: RegExpExecArray | null;

  while (
    (match = regex.exec(html)) !== null
  ) {
    const url = match[0]
      .replace(/&amp;/gi, "&")
      .replace(/\\\//g, "/");

    if (!seen.has(url)) {
      seen.add(url);
      result.push(url);
    }
  }

  /*
   * También puede aparecer como iframe src.
   */
  const srcRegex =
    /<iframe\b[^>]*src=["']([^"']*contenedor\.php\?id=[^"']+)["']/gi;

  while (
    (match = srcRegex.exec(html)) !== null
  ) {
    let url =
      match[1]
        .replace(/&amp;/gi, "&")
        .replace(/\\\//g, "/");

    if (
      !/^https?:\/\//i.test(url)
    ) {
      url =
        `https://animed23.online${url.startsWith("/") ? "" : "/"}${url}`;
    }

    if (!seen.has(url)) {
      seen.add(url);
      result.push(url);
    }
  }

  return result;
}

/**
 * Extrae enlaces /capitulo/ desde la página
 * /anime/.
 */
function extractEpisodeLinks(
  html: string,
): AnimeD23EpisodeLink[] {
  const result: AnimeD23EpisodeLink[] = [];
  const seen = new Set<string>();

  const regex =
    /<a\b([^>]*href=["']([^"']*\/capitulo\/[^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while (
    (match = regex.exec(html)) !== null
  ) {
    let url =
      match[2]
        .replace(/&amp;/gi, "&")
        .replace(/\\\//g, "/")
        .trim();

    const text =
      cleanHtml(match[3]);

    if (
      !/^https?:\/\//i.test(url)
    ) {
      url =
        `https://animed23.com${url.startsWith("/") ? "" : "/"}${url}`;
    }

    const parsed =
      new URL(url);

    const parts =
      parsed.pathname
        .split("/")
        .filter(Boolean);

    const slug =
      parts[1] || "";

    if (!slug) {
      continue;
    }

    const key =
      url.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    result.push({
      url,
      slug,
      text,
    });
  }

  return result;
}

function episodeLinkScore(
  link: AnimeD23EpisodeLink,
  episode: number,
): number {
  const slug =
    link.slug.toLowerCase();

  const text =
    link.text.toLowerCase();

  const exactEpisode =
    new RegExp(
      `(?:^|-)(?:ep|episodio|episode)-?${episode}(?:-|$)`,
      "i",
    );

  if (
    exactEpisode.test(slug) ||
    exactEpisode.test(text)
  ) {
    return 100;
  }

  /*
   * Algunos capítulos de AnimeD23
   * aparecen simplemente como:
   *
   * anime-2026
   */
  if (
    episode === 1 &&
    /(?:^|-)(?:19|20)\d{2}(?:-|$)/.test(
      slug,
    )
  ) {
    return 80;
  }

  const numberRegex =
    new RegExp(
      `\\b${episode}\\b`,
    );

  if (
    numberRegex.test(text)
  ) {
    return 70;
  }

  return 0;
}

/**
 * Obtiene la página de capítulo correcta.
 */
async function findPlayerPage(
  variant: string,
  episode: number,
): Promise<string | null> {
  /*
   * Primero intentamos directamente.
   */
  const directCandidates = [
    `/capitulo/${variant}-ep-${episode}/`,
    `/capitulo/${variant}-${episode}/`,
  ];

  /*
   * Para películas / especiales.
   */
  for (
    const year of [
      2026,
      2025,
      2024,
      2023,
    ]
  ) {
    directCandidates.push(
      `/capitulo/${variant}-${year}/`,
    );

    directCandidates.push(
      `/capitulo/${variant}-${year}-ep-${episode}/`,
    );
  }

  for (
    const path of directCandidates
  ) {
    for (
      const host of HOSTS
    ) {
      const url =
        `${host}${path}`;

      const html =
        await fetchHtml(url);

      if (!html) {
        continue;
      }

      /*
       * Si es directamente el player,
       * ya encontramos lo que necesitamos.
       */
      if (
        extractOptionsUrls(html).length ||
        extractContainerUrls(html).length ||
        extractVideoTabs(html).length
      ) {
        return url;
      }
    }
  }

  /*
   * Si no encontramos el player directamente,
   * entramos en /anime/{slug}/ y descubrimos
   * el permalink real.
   */
  for (
    const host of HOSTS
  ) {
    const animeUrl =
      `${host}/anime/${variant}/`;

    const animeHtml =
      await fetchHtml(animeUrl);

    if (!animeHtml) {
      continue;
    }

    /*
     * Si la página de anime contiene
     * directamente un videoTabs, también sirve.
     */
    if (
      extractVideoTabs(
        animeHtml,
      ).length
    ) {
      return animeUrl;
    }

    const links =
      extractEpisodeLinks(
        animeHtml,
      );

    if (!links.length) {
      continue;
    }

    const ranked =
      links
        .map(link => ({
          link,
          score:
            episodeLinkScore(
              link,
              episode,
            ),
        }))
        .sort(
          (a, b) =>
            b.score -
            a.score,
        );

    if (
      ranked[0] &&
      ranked[0].score > 0
    ) {
      return ranked[0].link.url;
    }

    /*
     * Película/OVA de un solo capítulo.
     */
    if (
      episode === 1 &&
      links.length === 1
    ) {
      return links[0].url;
    }
  }

  return null;
}

/**
 * Fetch de una página que puede ser:
 *
 * player
 * options.php
 * contenedor.php
 */
async function fetchServersFromPage(
  url: string,
): Promise<AnimeD23Server[]> {
  const html =
    await fetchHtml(url);

  if (!html) {
    return [];
  }

  /*
   * CASO 1:
   * Ya tenemos videoTabs.
   */
  let servers =
    extractVideoTabs(html);

  if (servers.length) {
    return servers;
  }

  /*
   * CASO 2:
   * player -> options.php
   */
  const optionsUrls =
    extractOptionsUrls(html);

  for (
    const optionsUrl of
    optionsUrls
  ) {
    try {
      const response =
        await fetch(
          optionsUrl,
          {
            method: "GET",
            headers:
              getHeaders(
                optionsUrl,
              ),
            redirect: "follow",
          },
        );

      if (!response.ok) {
        continue;
      }

      const optionsHtml =
        await response.text();

      /*
       * Lo importante:
       * options.php puede devolver el
       * HTML que contiene videoTabs.
       */
      servers =
        extractVideoTabs(
          optionsHtml,
        );

      if (servers.length) {
        return servers;
      }

      /*
       * O puede devolver un iframe
       * hacia contenedor.php.
       */
      const containers =
        extractContainerUrls(
          optionsHtml,
        );

      for (
        const containerUrl of
        containers
      ) {
        const containerServers =
          await fetchServersFromPage(
            containerUrl,
          );

        if (
          containerServers.length
        ) {
          return containerServers;
        }
      }

      /*
       * Último fallback:
       * buscar opciones nuevamente
       * dentro de la respuesta.
       */
      const nestedOptions =
        extractOptionsUrls(
          optionsHtml,
        );

      for (
        const nestedUrl of
        nestedOptions
      ) {
        if (
          nestedUrl ===
          optionsUrl
        ) {
          continue;
        }

        const nestedServers =
          await fetchServersFromPage(
            nestedUrl,
          );

        if (
          nestedServers.length
        ) {
          return nestedServers;
        }
      }
    } catch {
      continue;
    }
  }

  /*
   * CASO 3:
   * contenedor.php estaba directamente
   * en la página.
   */
  const containers =
    extractContainerUrls(html);

  for (
    const containerUrl of
    containers
  ) {
    const containerServers =
      await fetchServersFromPage(
        containerUrl,
      );

    if (
      containerServers.length
    ) {
      return containerServers;
    }
  }

  return [];
}

/**
 * Función principal.
 *
 * aliases = títulos de AniList:
 * romaji, english, native, synonyms...
 */
export async function getAnimeD23Servers(
  slug: string,
  episode: number,
  aliases: string[] = [],
): Promise<AnimeD23Server[]> {
  const titles = [
    slug,
    ...aliases,
  ].filter(Boolean);

  const variants =
    new Set<string>();

  for (
    const title of titles
  ) {
    for (
      const variant of
      generateSlugVariants(
        title,
      )
    ) {
      variants.add(variant);
    }
  }

  /*
   * Ordenamos colocando primero
   * las variantes que conservan
   * exactamente el título recibido.
   */
  const ordered =
    [
      ...variants,
    ].sort(
      (a, b) => {
        const original =
          slugify(slug);

        if (a === original) {
          return -1;
        }

        if (b === original) {
          return 1;
        }

        return (
          a.length -
          b.length
        );
      },
    );

  /*
   * Evitamos demasiadas peticiones
   * al mismo sitio.
   */
  for (
    const variant of
    ordered.slice(0, 20)
  ) {
    const player =
      await findPlayerPage(
        variant,
        episode,
      );

    if (!player) {
      continue;
    }

    const servers =
      await fetchServersFromPage(
        player,
      );

    if (
      servers.length
    ) {
      return servers;
    }
  }

  return [];
}
