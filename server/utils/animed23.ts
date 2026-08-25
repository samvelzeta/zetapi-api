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

const PROVIDER_RULES: Array<{ name: string; pattern: RegExp }> = [
  { name: "Moon", pattern: /bysesukior\.com/i },
  { name: "Mytsumi", pattern: /mytsumi\.com/i },
  { name: "Mega", pattern: /mega\.nz/i },
  { name: "Archive", pattern: /archive\.org/i },
  { name: "MP4Upload", pattern: /mp4upload\.com/i },
  { name: "Zilla", pattern: /zilla-networks\.com/i },
  { name: "OK", pattern: /(?:^|[./])ok\.ru/i },
  { name: "Epsilon", pattern: /ytplay/i },
  { name: "Abyss", pattern: /abyssplayer/i },
  { name: "GoFile", pattern: /gofile\.io/i },
  { name: "MediaFire", pattern: /mediafire\.com/i },
  { name: "FireLoad", pattern: /fireload/i },
  { name: "Tera", pattern: /terabox/i },
];

function decodeHtml(value: string): string {
  let result = String(value || "");

  for (let i = 0; i < 3; i++) {
    result = result
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
      .replace(/\\u002F/gi, "/")
      .replace(/\\u003A/gi, ":")
      .replace(/\\u003a/gi, ":")
      .replace(/\\\//g, "/")
      .replace(/\\"/g, '"');
  }

  return result.trim();
}

function normalizeSource(value: string): string {
  return decodeHtml(value)
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u002f/gi, "/")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/");
}

function normalizeUrl(value: string): string {
  let url = normalizeSource(value)
    .replace(/[\r\n\t]/g, "")
    .replace(/[)"'<>]+$/g, "")
    .trim();

  /*
   * AnimeD23 utiliza ocasionalmente:
   *
   * https://mytsumi.com//multiplayer//play2026//player.php
   *
   * Lo convertimos a:
   *
   * https://mytsumi.com/multiplayer/play2026/player.php
   *
   * Esto NO altera el host ni los parámetros.
   */
  url = url.replace(/^(https?:\/\/[^/]+)\/+/i, "$1/");

  url = url.replace(
    /^(https?:\/\/[^/]+)(\/{2,})/i,
    "$1/",
  );

  url = url.replace(/\/{2,}/g, "/");

  /*
   * Restauramos https:// porque el replace anterior podría
   * afectar únicamente la parte del path.
   */
  url = url.replace(/^https?:\/([^/])/i, (match, char) => {
    const protocol = match.toLowerCase().startsWith("https")
      ? "https://"
      : "http://";

    return `${protocol}${char}`;
  });

  return url;
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

function generateSlugVariants(value: string): string[] {
  const base = slugify(value);

  if (!base) return [];

  const result = new Set<string>();

  const add = (candidate: string) => {
    const clean = candidate
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (clean) {
      result.add(clean);
    }
  };

  add(base);

  const season = base.match(
    /^(.*?)-(?:temporada|season|t)-?(\d+)$/i,
  );

  if (season) {
    const title = season[1];
    const number = season[2];

    add(title);
    add(`${title}-${number}`);
    add(`${title}-${number}-season`);
    add(`${title}-${number}th-season`);
    add(`${title}-season-${number}`);
    add(`${title}-temporada-${number}`);
  }

  const ordinal = base.match(
    /^(.*?)-(\d+)(?:st|nd|rd|th)-season$/i,
  );

  if (ordinal) {
    const title = ordinal[1];
    const number = ordinal[2];

    add(title);
    add(`${title}-${number}`);
    add(`${title}-${number}-season`);
    add(`${title}-${number}th-season`);
    add(`${title}-season-${number}`);
    add(`${title}-temporada-${number}`);
  }

  add(base.replace(/-(?:19|20)\d{2}$/, ""));

  add(
    base.replace(
      /-(?:temporada|season|part|parte|cour|t)-?\d+$/i,
      "",
    ),
  );

  if (base.endsWith("-movie")) {
    add(base.replace(/-movie$/, ""));
  }

  return [...result].slice(0, 50);
}

function extractEpisodeNumber(value: string): number | null {
  const text = String(value || "").toLowerCase();

  const patterns = [
    /(?:^|[-_\s])ep(?:isode|isodio)?[-_\s]*(\d+)(?:$|[-_\s])/i,
    /(?:^|[-_\s])episodio[-_\s]*(\d+)(?:$|[-_\s])/i,
    /(?:^|[-_\s])episode[-_\s]*(\d+)(?:$|[-_\s])/i,
    /(?:^|[-_\s])cap(?:itulo)?[-_\s]*(\d+)(?:$|[-_\s])/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function extractEpisodeLinks(html: string): EpisodeLink[] {
  const result: EpisodeLink[] = [];
  const seen = new Set<string>();

  const addUrl = (
    rawUrl: string,
    text = "",
  ) => {
    let url = normalizeUrl(rawUrl);

    if (!url) return;

    if (!/^https?:\/\//i.test(url)) {
      url =
        `${HOSTS[0]}${url.startsWith("/") ? "" : "/"}${url}`;
    }

    try {
      const parsed = new URL(url);

      const parts = parsed.pathname
        .split("/")
        .filter(Boolean);

      const index = parts.findIndex(
        p => p.toLowerCase() === "capitulo",
      );

      if (index < 0 || !parts[index + 1]) {
        return;
      }

      const key = url.toLowerCase();

      if (seen.has(key)) {
        return;
      }

      seen.add(key);

      result.push({
        url,
        slug: parts[index + 1],
        text: decodeHtml(
          text
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
        ),
      });
    } catch {
      // URL inválida
    }
  };

  const hrefRegex =
    /<a\b[^>]*href\s*=\s*["']([^"']*\/capitulo\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    addUrl(match[1], match[2]);
  }

  const rawRegex =
    /https?:\/\/animed23\.(?:com|online)\/capitulo\/[A-Za-z0-9%._~:/?#\[\]@!$&()*+,;=\-\\]+/gi;

  while ((match = rawRegex.exec(html)) !== null) {
    addUrl(match[0], match[0]);
  }

  return result;
}

function selectEpisode(
  episodes: EpisodeLink[],
  number: number,
  animeSlug: string,
): EpisodeLink | null {
  if (!episodes.length) {
    return null;
  }

  for (const episode of episodes) {
    if (
      extractEpisodeNumber(
        `${episode.slug} ${episode.text}`,
      ) === number
    ) {
      return episode;
    }
  }

  const epRegex = new RegExp(
    `(?:^|[-_])ep[-_]?${number}(?:$|[-_])`,
    "i",
  );

  for (const episode of episodes) {
    if (epRegex.test(episode.slug)) {
      return episode;
    }
  }

  if (episodes.length === 1) {
    return episodes[0];
  }

  const normalizedAnime = slugify(animeSlug);

  const candidates = episodes.filter(
    episode =>
      normalizeTitle(episode.slug).includes(
        normalizeTitle(normalizedAnime),
      ),
  );

  if (candidates.length === 1) {
    return candidates[0];
  }

  const withoutNumber = episodes.filter(
    episode =>
      extractEpisodeNumber(episode.slug) === null,
  );

  if (withoutNumber.length === 1) {
    return withoutNumber[0];
  }

  return null;
}

function extractUrlCandidates(
  html: string,
  pattern: RegExp,
): string[] {
  const source = normalizeSource(html);

  const result: string[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const url = normalizeUrl(match[0]);

    if (!/^https?:\/\//i.test(url)) {
      continue;
    }

    const key = url
      .toLowerCase()
      .replace(/\/+$/, "");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(url);
  }

  return result;
}

function extractPlayerUrl(
  html: string,
): string | null {
  const source = normalizeSource(html);

  const patterns = [
    /https?:\/\/animed23\.(?:com|online)\/opciones\/player\.php\?data=[^"'<>\\\s]+/gi,
    /\/opciones\/player\.php\?data=[^"'<>\\\s]+/gi,
  ];

  for (const pattern of patterns) {
    const urls = extractUrlCandidates(
      source,
      pattern,
    );

    if (urls[0]) {
      return /^https?:\/\//i.test(urls[0])
        ? urls[0]
        : `${HOSTS[0]}${urls[0]}`;
    }
  }

  return null;
}

function extractContainerUrl(
  html: string,
): string | null {
  const source = normalizeSource(html);

  const patterns = [
    /https?:\/\/animed23\.(?:com|online)\/multiplayer\/contenedor\.php\?id=[^"'<>\\\s]+/gi,
    /\/multiplayer\/contenedor\.php\?id=[^"'<>\\\s]+/gi,
  ];

  for (const pattern of patterns) {
    const urls = extractUrlCandidates(
      source,
      pattern,
    );

    if (urls[0]) {
      return /^https?:\/\//i.test(urls[0])
        ? urls[0]
        : `${HOSTS[0]}${urls[0]}`;
    }
  }

  return null;
}

function providerName(url: string): string {
  for (const rule of PROVIDER_RULES) {
    if (rule.pattern.test(url)) {
      return rule.name;
    }
  }

  return "AnimeD23";
}

function classifyUrl(
  url: string,
): "iframe" | "mp4" {
  return /\.(?:mp4|m3u8)(?:$|[?#])/i.test(url)
    ? "mp4"
    : "iframe";
}

function isKnownProviderUrl(
  url: string,
): boolean {
  return /(?:bysesukior|mytsumi\.com|mega\.nz|archive\.org|mp4upload\.com|zilla-networks|ok\.ru|ytplay|abyssplayer|gofile\.io|mediafire\.com|fireload|terabox)/i.test(
    url,
  );
}

function extractProviderUrls(
  html: string,
): AnimeD23Server[] {
  const source = normalizeSource(html);

  const found: AnimeD23Server[] = [];
  const seen = new Set<string>();

  const add = (
    rawUrl: string,
    forcedName?: string,
  ) => {
    let clean = normalizeUrl(rawUrl);

    if (!/^https?:\/\//i.test(clean)) {
      return;
    }

    const key = clean
      .toLowerCase()
      .replace(/\/+$/, "");

    if (seen.has(key)) {
      return;
    }

    seen.add(key);

    found.push({
      name:
        forcedName ||
        providerName(clean),
      url: clean,
      type: classifyUrl(clean),
    });
  };

  /*
   * ========================================================
   * TODAS LAS URLS ABSOLUTAS DEL HTML
   * ========================================================
   */

  const allUrlRegex =
    /https?:\/\/[^"'<>\\\s]+/gi;

  for (const rawUrl of extractUrlCandidates(
    source,
    allUrlRegex,
  )) {
    if (isKnownProviderUrl(rawUrl)) {
      add(rawUrl);
    }
  }

  /*
   * ========================================================
   * IFRAME SRC
   *
   * MUY IMPORTANTE PARA MYTSUMI
   *
   * Ejemplo real:
   *
   * <iframe src="https://mytsumi.com//multiplayer//play2026//
   * player.php?data=...">
   *
   * También soportamos:
   *
   * https:\/\/mytsumi.com\/multiplayer\/...
   * ========================================================
   */

  const iframeRegex =
    /<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

  for (const match of source.matchAll(iframeRegex)) {
    let raw = normalizeUrl(match[1]);

    if (!raw) {
      continue;
    }

    if (!/^https?:\/\//i.test(raw)) {
      continue;
    }

    if (isKnownProviderUrl(raw)) {
      add(raw);
    }
  }

  /*
   * ========================================================
   * MYTSUMI ESPECÍFICO
   * ========================================================
   */

  const mytsumiPatterns = [
    /https?:\/\/mytsumi\.com\/+multiplayer\/+play2026\/+player\.php\?data=[^"'<>\\\s]+/gi,
    /https?:\\\/\\\/mytsumi\.com\\\/+multiplayer\\\/+play2026\\\/+player\.php\?data=[^"'<>\\\s]+/gi,
    /https?:\/\/mytsumi\.com\/[^"'<>\\\s]*player\.php\?data=[^"'<>\\\s]+/gi,
  ];

  for (const pattern of mytsumiPatterns) {
    for (const url of extractUrlCandidates(
      source,
      pattern,
    )) {
      add(url, "Mytsumi");
    }
  }

  /*
   * ========================================================
   * MP4UPLOAD
   * ========================================================
   */

  const mp4Patterns = [
    /https?:\/\/[^"'<>\\\s]*mp4upload\.com\/embed-[A-Za-z0-9]+\.html/gi,
    /https?:\/\/[^"'<>\\\s]*mp4upload\.com\/e\/[A-Za-z0-9]+/gi,
  ];

  for (const pattern of mp4Patterns) {
    for (const url of extractUrlCandidates(
      source,
      pattern,
    )) {
      add(url, "MP4Upload");
    }
  }

  /*
   * ========================================================
   * MEGA
   * ========================================================
   */

  const megaPatterns = [
    /https?:\/\/[^"'<>\\\s]*mega\.nz\/(?:embed|file)\/[^"'<>\\\s]+/gi,
  ];

  for (const pattern of megaPatterns) {
    for (const url of extractUrlCandidates(
      source,
      pattern,
    )) {
      add(url, "Mega");
    }
  }

  /*
   * ========================================================
   * ARCHIVE
   * ========================================================
   */

  const archivePatterns = [
    /https?:\/\/[^"'<>\\\s]*archive\.org\/(?:download|serve)\/[^"'<>\\\s]+/gi,
  ];

  for (const pattern of archivePatterns) {
    for (const url of extractUrlCandidates(
      source,
      pattern,
    )) {
      add(url, "Archive");
    }
  }

  /*
   * ========================================================
   * ZILLA
   * ========================================================
   */

  const zillaPatterns = [
    /https?:\/\/player\.zilla-networks\.com\/play\/[A-Za-z0-9_-]+/gi,
  ];

  for (const pattern of zillaPatterns) {
    for (const url of extractUrlCandidates(
      source,
      pattern,
    )) {
      add(url, "Zilla");
    }
  }

  /*
   * ========================================================
   * MOON / BYSESUKIOR
   * ========================================================
   */

  const moonPatterns = [
    /https?:\/\/[^"'<>\\\s]*bysesukior\.com\/e\/[A-Za-z0-9_-]+/gi,
  ];

  for (const pattern of moonPatterns) {
    for (const url of extractUrlCandidates(
      source,
      pattern,
    )) {
      add(url, "Moon");
    }
  }

  return found;
}

/* ============================================================
 * EXTRAER MEDIA REAL DE UN PROVIDER
 *
 * Caso:
 *
 * Mytsumi
 *    ↓
 * <video src="https://archive.org/download/...mp4">
 *
 * ========================================================== */

function extractDirectMediaUrls(
  html: string,
): AnimeD23Server[] {
  const source = normalizeSource(html);

  const found: AnimeD23Server[] = [];
  const seen = new Set<string>();

  const add = (
    rawUrl: string,
    forcedName?: string,
  ) => {
    const clean = normalizeUrl(rawUrl);

    if (!/^https?:\/\//i.test(clean)) {
      return;
    }

    const key = clean
      .toLowerCase()
      .replace(/\/+$/, "");

    if (seen.has(key)) {
      return;
    }

    seen.add(key);

    found.push({
      name:
        forcedName ||
        providerName(clean),
      url: clean,
      type: classifyUrl(clean),
    });
  };

  /*
   * <video src="">
   */

  const videoSrcRegex =
    /<video\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

  for (const match of source.matchAll(
    videoSrcRegex,
  )) {
    const url = normalizeUrl(match[1]);

    if (/archive\.org/i.test(url)) {
      add(url, "Archive");
    } else if (
      /\.(?:mp4|m3u8)(?:$|[?#])/i.test(url)
    ) {
      add(url);
    }
  }

  /*
   * <source src="">
   */

  const sourceRegex =
    /<source\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

  for (const match of source.matchAll(
    sourceRegex,
  )) {
    const url = normalizeUrl(match[1]);

    if (/archive\.org/i.test(url)) {
      add(url, "Archive");
    } else if (
      /\.(?:mp4|m3u8)(?:$|[?#])/i.test(url)
    ) {
      add(url);
    }
  }

  /*
   * Archive directo aunque no aparezca dentro
   * de <video>.
   */

  const archiveRegex =
    /https?:\/\/[^"'<>\\\s]*archive\.org\/(?:download|serve)\/[^"'<>\\\s]+/gi;

  for (const url of extractUrlCandidates(
    source,
    archiveRegex,
  )) {
    add(url, "Archive");
  }

  /*
   * MP4/M3U8 directos.
   */

  const mediaRegex =
    /https?:\/\/[^"'<>\\\s]+\.(?:mp4|m3u8)(?:\?[^"'<>\\\s]*)?/gi;

  for (const url of extractUrlCandidates(
    source,
    mediaRegex,
  )) {
    add(url);
  }

  return found;
}

async function fetchRawHtml(
  url: string,
  referer?: string,
): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      ...getHeaders(url),
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };

    if (referer) {
      headers.Referer = referer;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      redirect: "follow",
    });

    if (!response.ok) {
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
 * EXTRAER PLAYER DEL EPISODIO
 * ========================================================== */

async function getEpisodePlayer(
  episodeUrl: string,
): Promise<AnimeD23Server[]> {
  console.log(
    "🎬 AnimeD23 episodio:",
    episodeUrl,
  );

  const episodeHtml =
    await fetchRawHtml(episodeUrl);

  if (!episodeHtml) {
    return [];
  }

  /*
   * 1.
   *
   * capítulo
   *    ↓
   * opciones/player.php?data=...
   */

  const playerUrl =
    extractPlayerUrl(episodeHtml);

  if (!playerUrl) {
    console.log(
      "⚠️ AnimeD23: no se encontró player.php?data=",
    );

    const directContainer =
      extractContainerUrl(episodeHtml);

    if (directContainer) {
      const containerHtml =
        await fetchRawHtml(
          directContainer,
          episodeUrl,
        );

      if (!containerHtml) {
        return [];
      }

      return await expandProviderFrames(
        containerHtml,
        directContainer,
      );
    }

    return extractProviderUrls(
      episodeHtml,
    );
  }

  console.log(
    "🔗 AnimeD23 player.php:",
    playerUrl,
  );

  /*
   * 2.
   *
   * player.php
   *    ↓
   * multiplayer/contenedor.php?id=...
   */

  const playerHtml =
    await fetchRawHtml(
      playerUrl,
      episodeUrl,
    );

  if (!playerHtml) {
    return [];
  }

  const containerUrl =
    extractContainerUrl(playerHtml);

  if (!containerUrl) {
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
   * 3.
   *
   * contenedor.php
   *    ↓
   * iframe Mytsumi / Mega / etc.
   */

  const containerHtml =
    await fetchRawHtml(
      containerUrl,
      playerUrl,
    );

  if (!containerHtml) {
    return [];
  }

  return await expandProviderFrames(
    containerHtml,
    containerUrl,
  );
}

/* ============================================================
 * EXTRAER IFRAMES Y ENTRAR EN ELLOS
 *
 * Árbol real:
 *
 * contenedor.php
 *   │
 *   ├── iframe Mytsumi
 *   │      │
 *   │      └── video
 *   │             └── Archive.org
 *   │
 *   ├── iframe Mega
 *   ├── iframe MP4Upload
 *   ├── iframe Zilla
 *   └── iframe Moon
 *
 * El punto importante es que Mytsumi NO se considera solamente
 * por su URL.
 *
 * También se entra a su HTML para descubrir Archive.
 * ========================================================== */

async function expandProviderFrames(
  containerHtml: string,
  containerUrl: string,
): Promise<AnimeD23Server[]> {
  const results: AnimeD23Server[] = [];
  const seen = new Set<string>();

  const addResult = (
    server: AnimeD23Server,
  ) => {
    if (!server?.url) {
      return;
    }

    const cleanUrl =
      normalizeUrl(server.url);

    const key = cleanUrl
      .trim()
      .toLowerCase()
      .replace(/\/+$/, "");

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);

    results.push({
      ...server,
      url: cleanUrl,
    });
  };

  /*
   * ----------------------------------------------------------
   * PRIMERO:
   * servidores que ya aparecen directamente.
   * ----------------------------------------------------------
   */

  for (const server of extractProviderUrls(
    containerHtml,
  )) {
    addResult(server);
  }

  /*
   * ----------------------------------------------------------
   * SEGUNDO:
   * EXTRAER TODOS LOS IFRAME DEL CONTENEDOR
   *
   * No dependemos únicamente de providerName.
   * ----------------------------------------------------------
   */

  const source =
    normalizeSource(containerHtml);

  const iframeRegex =
    /<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

  const frameUrls: string[] = [];

  for (const match of source.matchAll(
    iframeRegex,
  )) {
    let frameUrl =
      normalizeUrl(match[1]);

    if (!frameUrl) {
      continue;
    }

    try {
      frameUrl =
        new URL(
          frameUrl,
          containerUrl,
        ).href;
    } catch {
      continue;
    }

    frameUrl =
      normalizeUrl(frameUrl);

    /*
     * Aquí NO descartamos inmediatamente el iframe.
     *
     * Si es Mytsumi, Mega, MP4Upload, Zilla,
     * Moon, etc. lo procesamos.
     */

    if (
      isKnownProviderUrl(frameUrl)
    ) {
      frameUrls.push(frameUrl);
    }
  }

  /*
   * ----------------------------------------------------------
   * TERCERO:
   * patrones específicos para casos donde el iframe está
   * codificado de forma extraña.
   * ----------------------------------------------------------
   */

  const explicitMytsumiPatterns = [
    /https?:\/\/mytsumi\.com\/+multiplayer\/+play2026\/+player\.php\?data=[^"'<>\\\s]+/gi,
    /https?:\\\/\\\/mytsumi\.com\\\/+multiplayer\\\/+play2026\\\/+player\.php\?data=[^"'<>\\\s]+/gi,
  ];

  for (const pattern of explicitMytsumiPatterns) {
    for (const url of extractUrlCandidates(
      source,
      pattern,
    )) {
      frameUrls.push(
        normalizeUrl(url),
      );
    }
  }

  const uniqueFrameUrls = [
    ...new Set(
      frameUrls.map(
        url => normalizeUrl(url),
      ),
    ),
  ];

  console.log(
    "🔎 AnimeD23 iframes detectados:",
    uniqueFrameUrls,
  );

  /*
   * ----------------------------------------------------------
   * CUARTO:
   * ENTRAR A CADA PROVIDER
   * ----------------------------------------------------------
   */

  for (const frameUrl of uniqueFrameUrls) {
    const cleanFrameUrl =
      normalizeUrl(frameUrl);

    const name =
      providerName(cleanFrameUrl);

    /*
     * El iframe original siempre se conserva.
     *
     * Por ejemplo:
     *
     * Mytsumi
     * https://mytsumi.com/...
     */

    addResult({
      name,
      url: cleanFrameUrl,
      type: classifyUrl(
        cleanFrameUrl,
      ),
    });

    /*
     * Si ya es un archivo de vídeo no necesitamos
     * analizarlo como HTML.
     */

    if (
      /\.(?:mp4|m3u8)(?:$|[?#])/i.test(
        cleanFrameUrl,
      )
    ) {
      continue;
    }

    /*
     * --------------------------------------------------------
     * FETCH DEL IFRAME
     *
     * AQUÍ está la parte que necesitábamos para tu captura.
     * --------------------------------------------------------
     */

    try {
      console.log(
        "🌐 AnimeD23 entrando a provider:",
        cleanFrameUrl,
      );

      const providerHtml =
        await fetchRawHtml(
          cleanFrameUrl,
          containerUrl,
        );

      if (!providerHtml) {
        console.log(
          "⚠️ AnimeD23 provider sin HTML:",
          cleanFrameUrl,
        );

        continue;
      }

      /*
       * ------------------------------------------------------
       * MEDIA DIRECTA
       *
       * Busca:
       *
       * <video src="https://archive.org/...">
       *
       * <source src="...">
       *
       * archive.org en JavaScript
       * ------------------------------------------------------
       */

      const directMedia =
        extractDirectMediaUrls(
          providerHtml,
        );

      for (const server of directMedia) {
        addResult(server);
      }

      /*
       * ------------------------------------------------------
       * PROVIDERS DENTRO DEL PROVIDER
       *
       * Por si Mytsumi / otro reproductor contiene
       * otro iframe.
       * ------------------------------------------------------
       */

      const nestedProviders =
        extractProviderUrls(
          providerHtml,
        );

      for (
        const server of nestedProviders
      ) {
        if (
          server.url.toLowerCase() !==
          cleanFrameUrl.toLowerCase()
        ) {
          addResult(server);
        }
      }

      /*
       * ------------------------------------------------------
       * BUSCAR IFRAME ANIDADOS DIRECTAMENTE
       * ------------------------------------------------------
       */

      const nestedIframeRegex =
        /<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

      for (
        const match of providerHtml.matchAll(
          nestedIframeRegex,
        )
      ) {
        let nestedUrl =
          normalizeUrl(match[1]);

        if (!nestedUrl) {
          continue;
        }

        try {
          nestedUrl =
            new URL(
              nestedUrl,
              cleanFrameUrl,
            ).href;
        } catch {
          continue;
        }

        nestedUrl =
          normalizeUrl(
            nestedUrl,
          );

        if (
          !isKnownProviderUrl(
            nestedUrl,
          )
        ) {
          continue;
        }

        addResult({
          name:
            providerName(
              nestedUrl,
            ),
          url: nestedUrl,
          type:
            classifyUrl(
              nestedUrl,
            ),
        });

        /*
         * Segundo nivel de fetch.
         *
         * Esto es especialmente útil si algún provider
         * mete el vídeo dentro de otro iframe.
         */

        if (
          /\.(?:mp4|m3u8)(?:$|[?#])/i.test(
            nestedUrl,
          )
        ) {
          continue;
        }

        try {
          const nestedHtml =
            await fetchRawHtml(
              nestedUrl,
              cleanFrameUrl,
            );

          if (!nestedHtml) {
            continue;
          }

          const nestedMedia =
            extractDirectMediaUrls(
              nestedHtml,
            );

          for (
            const server of nestedMedia
          ) {
            addResult(server);
          }
        } catch (error) {
          console.log(
            "⚠️ AnimeD23 nested provider:",
            nestedUrl,
            error,
          );
        }
      }
    } catch (error) {
      console.log(
        "⚠️ AnimeD23 provider frame:",
        cleanFrameUrl,
        error,
      );
    }
  }

  console.log(
    "🎥 AnimeD23 servidores expandidos:",
    results.map(
      server => ({
        name: server.name,
        type: server.type,
        url: server.url,
      }),
    ),
  );

  return results;
}

async function findAnimePage(
  slug: string,
): Promise<{
  url: string;
  html: string;
} | null> {
  for (const host of HOSTS) {
    const url =
      `${host}/anime/${slug}/`;

    const html =
      await fetchHtml(url);

    if (html) {
      return {
        url,
        html,
      };
    }
  }

  return null;
}

function sortServers(
  servers: AnimeD23Server[],
): AnimeD23Server[] {
  const priority = (
    server: AnimeD23Server,
  ): number => {
    const name =
      server.name.toLowerCase();

    /*
     * Orden:
     *
     * Moon
     * Mytsumi
     * MP4Upload
     * Mega
     * Archive
     * Zilla
     * resto
     */

    if (name.includes("moon")) {
      return 0;
    }

    if (name.includes("mytsumi")) {
      return 1;
    }

    if (name.includes("mp4upload")) {
      return 2;
    }

    if (name.includes("mega")) {
      return 3;
    }

    if (name.includes("archive")) {
      return 4;
    }

    if (name.includes("zilla")) {
      return 5;
    }

    return 20;
  };

  return [...servers].sort(
    (a, b) =>
      priority(a) -
      priority(b),
  );
}

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
    generateSlugVariants(slug);

  /*
   * ========================================================
   * BÚSQUEDA NORMAL
   * ========================================================
   */

  for (const variant of variants) {
    try {
      const animePage =
        await findAnimePage(
          variant,
        );

      if (!animePage) {
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

      if (!selected) {
        continue;
      }

      const servers =
        await getEpisodePlayer(
          selected.url,
        );

      if (servers.length) {
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
   * ========================================================
   * FALLBACK DIRECTO
   * ========================================================
   */

  for (const variant of variants) {
    for (const host of HOSTS) {
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

          if (servers.length) {
            return sortServers(
              servers,
            );
          }
        } catch {
          // Continuar con el siguiente candidato.
        }
      }
    }
  }

  return [];
}
