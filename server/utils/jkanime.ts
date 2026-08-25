import { fetchHtml } from "./fetcher";

export interface JKServer {
  name: string;
  url: string;
  type: "iframe" | "mp4";
}

export interface JKSubtitle {
  lang: string;
  url: string;
}

function cleanUrl(
  value: string,
): string {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/\\\//g, "/")
    .replace(/\\u0026/gi, "&")
    .replace(/&quot;/gi, '"')
    .trim();
}

function normalizeUrl(
  value: string,
): string | null {
  let url =
    cleanUrl(value);

  if (!url) {
    return null;
  }

  /**
   * Protocol-relative.
   */
  if (
    url.startsWith("//")
  ) {
    url =
      `https:${url}`;
  }

  /**
   * Relative.
   */
  if (
    url.startsWith("/")
  ) {
    url =
      `https://jkanime.net${url}`;
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

/**
 * Obtiene el nombre correcto de video[index].
 *
 * JKAnime históricamente utiliza:
 *
 * video[0] = Desu
 * video[1] = Magi
 *
 * Para que el resultado final quede:
 *
 * Magi
 * Desu
 *
 * usamos prioridades independientes.
 */
function getVideoName(
  index: number,
): string {
  if (index === 0) {
    return "Desu";
  }

  if (index === 1) {
    return "Magi";
  }

  return `JKAnime ${index + 1}`;
}

/**
 * Prioridad:
 *
 * Magi primero
 * Desu segundo
 * resto después
 */
function getVideoPriority(
  index: number,
): number {
  if (index === 1) {
    return 0;
  }

  if (index === 0) {
    return 1;
  }

  return 2 + index;
}

/**
 * -------------------------------------------------------
 * EXTRAER VIDEO[index]
 * -------------------------------------------------------
 */
function extractVideoAssignments(
  html: string,
): JKServer[] {
  const result: Array<
    JKServer & {
      _priority: number;
    }
  > = [];

  const seen =
    new Set<string>();

  /**
   * Soporta:
   *
   * video[0] = '<iframe src="...">'
   * video[0]='<iframe src="...">'
   * video[0] = "<iframe src='...'>"
   *
   * También tolera espacios.
   */
  const assignmentRegex =
    /video\s*\[\s*(\d+)\s*\]\s*=\s*(['"])([\s\S]*?)\2\s*;?/gi;

  let match:
    RegExpExecArray | null;

  while (
    (match =
      assignmentRegex.exec(
        html,
      )) !== null
  ) {
    const index =
      Number.parseInt(
        match[1],
        10,
      );

    const assigned =
      match[3];

    /**
     * Dentro de la asignación
     * buscamos src.
     */
    const srcMatch =
      assigned.match(
        /\bsrc\s*=\s*["']([^"']+)["']/i,
      );

    if (!srcMatch) {
      continue;
    }

    const url =
      normalizeUrl(
        srcMatch[1],
      );

    if (!url) {
      continue;
    }

    const key =
      url
        .replace(/\/+$/, "")
        .toLowerCase();

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    result.push({
      name:
        getVideoName(
          index,
        ),
      url,
      type: "iframe",
      _priority:
        getVideoPriority(
          index,
        ),
    });
  }

  /**
   * -----------------------------------------------------
   * FALLBACK:
   * buscar directamente video[n] ... iframe src
   * por si la asignación contiene HTML escapado.
   * -----------------------------------------------------
   */
  const fallbackRegex =
    /video\s*\[\s*(\d+)\s*\][\s\S]{0,1000}?<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;

  while (
    (match =
      fallbackRegex.exec(
        html,
      )) !== null
  ) {
    const index =
      Number.parseInt(
        match[1],
        10,
      );

    const url =
      normalizeUrl(
        match[2],
      );

    if (!url) {
      continue;
    }

    const key =
      url
        .replace(/\/+$/, "")
        .toLowerCase();

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    result.push({
      name:
        getVideoName(
          index,
        ),
      url,
      type: "iframe",
      _priority:
        getVideoPriority(
          index,
        ),
    });
  }

  result.sort(
    (a, b) =>
      a._priority -
      b._priority,
  );

  return result.map(
    server => ({
      name: server.name,
      url: server.url,
      type: server.type,
    }),
  );
}

/**
 * -------------------------------------------------------
 * SERVERS var servers = [...]
 * -------------------------------------------------------
 */
function extractServersArray(
  html: string,
): JKServer[] {
  const result: JKServer[] = [];

  const seen =
    new Set<string>();

  const match =
    html.match(
      /(?:var|let|const)\s+servers\s*=\s*(\[[\s\S]*?\])\s*;/i,
    );

  if (!match) {
    return result;
  }

  let rawList: any[];

  try {
    rawList =
      JSON.parse(
        match[1],
      );
  } catch {
    return result;
  }

  if (
    !Array.isArray(
      rawList,
    )
  ) {
    return result;
  }

  for (
    const item of rawList
  ) {
    const server =
      String(
        item?.server || "",
      )
        .trim();

    const remote =
      String(
        item?.remote || "",
      )
        .trim();

    if (!server || !remote) {
      continue;
    }

    /**
     * YourUpload
     */
    if (
      server
        .toLowerCase() ===
      "yourupload"
    ) {
      const player =
        `https://jkanime.net/jkplayer/c1?u=${encodeURIComponent(
          remote,
        )}&s=yourupload`;

      const key =
        player
          .replace(/\/+$/, "")
          .toLowerCase();

      if (
        seen.has(key)
      ) {
        continue;
      }

      seen.add(key);

      result.push({
        name: "YourUpload",
        url: player,
        type: "iframe",
      });

      continue;
    }

    /**
     * Mega.
     */
    if (
      server
        .toLowerCase() ===
      "mega"
    ) {
      let decoded =
        "";

      try {
        decoded =
          atob(remote);
      } catch {
        try {
          decoded =
            atob(
              remote +
                "==",
            );
        } catch {
          decoded =
            "";
        }
      }

      const url =
        normalizeUrl(
          decoded,
        );

      if (!url) {
        continue;
      }

      const key =
        url
          .replace(/\/+$/, "")
          .toLowerCase();

      if (
        seen.has(key)
      ) {
        continue;
      }

      seen.add(key);

      result.push({
        name: "Mega",
        url,
        type: "mp4",
      });
    }
  }

  return result;
}

/**
 * -------------------------------------------------------
 * SERVIDORES JKANIME
 * -------------------------------------------------------
 */
export async function getJKAnimeServers(
  slug: string,
  episode: number,
): Promise<JKServer[]> {
  if (
    !slug ||
    !Number.isFinite(
      episode,
    )
  ) {
    return [];
  }

  const url =
    `https://jkanime.net/${slug}/${episode}/`;

  const html =
    await fetchHtml(url);

  if (!html) {
    return [];
  }

  const all: JKServer[] = [];

  const videoServers =
    extractVideoAssignments(
      html,
    );

  all.push(
    ...videoServers,
  );

  const otherServers =
    extractServersArray(
      html,
    );

  all.push(
    ...otherServers,
  );

  /**
   * Dedupe global.
   */
  const seen =
    new Set<string>();

  return all.filter(
    server => {
      const key =
        server.url
          .replace(
            /\/+$/,
            "",
          )
          .toLowerCase();

      if (
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);
      return true;
    },
  );
}

/**
 * -------------------------------------------------------
 * SUBTÍTULOS
 * -------------------------------------------------------
 */
export async function getJKAnimeSubtitles(
  slug: string,
  episode: number,
): Promise<JKSubtitle[]> {
  if (
    !slug ||
    !Number.isFinite(
      episode,
    )
  ) {
    return [];
  }

  const url =
    `https://jkanime.net/${slug}/${episode}/`;

  const html =
    await fetchHtml(url);

  if (!html) {
    return [];
  }

  const subs: JKSubtitle[] = [];

  const seen =
    new Set<string>();

  /**
   * Soporta atributos en cualquier orden.
   */
  const buttonRegex =
    /<button\b([^>]*)>/gi;

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

    const urlMatch =
      attrs.match(
        /\bdata-url\s*=\s*["']([^"']+)["']/i,
      );

    const langMatch =
      attrs.match(
        /\bdata-language\s*=\s*["']([^"']*)["']/i,
      );

    if (
      !urlMatch ||
      !langMatch
    ) {
      continue;
    }

    const lang =
      String(
        langMatch[1],
      )
        .toLowerCase()
        .trim();

    if (
      !(
        lang === "es" ||
        lang.includes(
          "spa",
        ) ||
        lang.includes(
          "español",
        ) ||
        lang.includes(
          "spanish",
        )
      )
    ) {
      continue;
    }

    const subUrl =
      normalizeUrl(
        urlMatch[1],
      );

    if (!subUrl) {
      continue;
    }

    if (
      seen.has(
        subUrl,
      )
    ) {
      continue;
    }

    seen.add(
      subUrl,
    );

    subs.push({
      lang: "Español",
      url: subUrl,
    });
  }

  return subs;
}
