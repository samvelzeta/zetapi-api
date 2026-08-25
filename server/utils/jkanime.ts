import { fetchHtml } from "./fetcher";

export interface JKServer {
  name: string;
  url: string;
  type: "iframe" | "mp4";
}

function cleanUrl(
  value: string,
): string {
  return String(value || "")
    .replace(
      /&amp;/gi,
      "&",
    )
    .replace(
      /\\\//g,
      "/",
    )
    .replace(
      /\\"/g,
      '"',
    )
    .trim();
}

/* ============================================================
 * FILTRO JKPLAYER
 * ========================================================== */

function isUsableJKPlayer(
  url: string,
): boolean {
  const value =
    cleanUrl(url)
      .toLowerCase();

  if (
    !/^https?:\/\/jkanime\.net\/jkplayer\//i.test(
      value,
    )
  ) {
    return false;
  }

  /*
   * ELIMINAR:
   *
   * https://jkanime.net/jkplayer/jk?u=stream/jkmedia/...
   *
   * Ese reproductor es el que no está cargando.
   */
  if (
    /[?&]u=stream\/jkmedia\//i.test(
      value,
    )
  ) {
    return false;
  }

  /*
   * Solamente:
   *
   * /jkplayer/um
   * /jkplayer/umv
   */
  return /^https?:\/\/jkanime\.net\/jkplayer\/umv?(?:[/?]|$)/i.test(
    value,
  );
}

/* ============================================================
 * AÑADIR SERVER
 * ========================================================== */

function addServer(
  servers: JKServer[],
  seen: Set<string>,
  name: string,
  rawUrl: string,
): void {
  const url =
    cleanUrl(rawUrl);

  if (
    !isUsableJKPlayer(
      url,
    )
  ) {
    return;
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
    return;
  }

  seen.add(key);

  servers.push({
    name,
    url,
    type: "iframe",
  });
}

/* ============================================================
 * JKANIME
 *
 * ÚNICAMENTE:
 *
 * Magi
 * Desu
 * ========================================================== */

export async function getJKAnimeServers(
  slug: string,
  episode: number,
): Promise<JKServer[]> {
  const url =
    `https://jkanime.net/${slug}/${episode}/`;

  console.log(
    "🔵 JKAnime:",
    url,
  );

  const html =
    await fetchHtml(
      url,
    );

  if (
    !html
  ) {
    console.log(
      "❌ JKAnime: HTML vacío",
    );

    return [];
  }

  const servers:
    JKServer[] = [];

  const seen =
    new Set<string>();

  /*
   * JKAnime:
   *
   * video[0] = Desu
   * video[1] = Magi
   */
  const exactVideoRegex =
    /video\[\s*(\d+)\s*\]\s*=\s*(['"])([\s\S]*?)\2/gi;

  for (
    const match of
      html.matchAll(
        exactVideoRegex,
      )
  ) {
    const index =
      Number.parseInt(
        match[1],
        10,
      );

    const content =
      match[3];

    const srcMatch =
      content.match(
        /<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i,
      );

    if (
      !srcMatch
    ) {
      continue;
    }

    const iframeUrl =
      cleanUrl(
        srcMatch[1],
      );

    if (
      index === 0
    ) {
      addServer(
        servers,
        seen,
        "Desu",
        iframeUrl,
      );
    } else if (
      index === 1
    ) {
      addServer(
        servers,
        seen,
        "Magi",
        iframeUrl,
      );
    }

    if (
      servers.length >= 2
    ) {
      break;
    }
  }

  /*
   * FALLBACK
   *
   * Si el HTML cambia la forma de video[].
   *
   * Solamente aceptamos:
   *
   * /um
   * /umv
   *
   * Nunca:
   *
   * /jk?u=stream/jkmedia/
   */
  if (
    servers.length < 2
  ) {
    const iframeRegex =
      /<iframe\b[^>]*\bsrc\s*=\s*["'](https?:\/\/jkanime\.net\/jkplayer\/[^"']+)["']/gi;

    for (
      const match of
        html.matchAll(
          iframeRegex,
        )
    ) {
      const iframeUrl =
        cleanUrl(
          match[1],
        );

      if (
        !isUsableJKPlayer(
          iframeUrl,
        )
      ) {
        continue;
      }

      const lower =
        iframeUrl.toLowerCase();

      const name =
        lower.includes(
          "/jkplayer/umv",
        )
          ? "Magi"
          : "Desu";

      addServer(
        servers,
        seen,
        name,
        iframeUrl,
      );

      if (
        servers.length >= 2
      ) {
        break;
      }
    }
  }

  /*
   * ORDEN ABSOLUTO:
   *
   * 1 Magi
   * 2 Desu
   */
  servers.sort(
    (a, b) => {
      const pa =
        a.name === "Magi"
          ? 0
          : 1;

      const pb =
        b.name === "Magi"
          ? 0
          : 1;

      return pa - pb;
    },
  );

  console.log(
    "✅ JKAnime players:",
    servers.map(
      server => ({
        name:
          server.name,
        url:
          server.url,
      }),
    ),
  );

  /*
   * JKAnime nunca devuelve más
   * de los dos players que queremos.
   */
  return servers.slice(
    0,
    2,
  );
}
