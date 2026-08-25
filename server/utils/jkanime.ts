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

// ----------------------------------------------------------
// EXTRAER SERVIDORES DE JKANIME
// Magi, Desu, YourUpload y Mega
// ----------------------------------------------------------

export async function getJKAnimeServers(
  slug: string,
  episode: number,
): Promise<JKServer[]> {
  const url =
    `https://jkanime.net/${slug}/${episode}/`;

  console.log(
    "🔎 JKAnime:",
    url,
  );

  const html =
    await fetchHtml(url);

  if (!html) {
    console.log(
      "❌ JKAnime: HTML vacío",
    );

    return [];
  }

  const servers: JKServer[] = [];
  const seen = new Set<string>();

  // --------------------------------------------------------
  // 1. MAGI / DESU
  //
  // JKAnime utiliza:
  //
  // video[0] = Desu
  // video[1] = Magi
  //
  // Mantenemos exactamente esta lógica porque es la que
  // funcionaba en el main del repositorio.
  // --------------------------------------------------------

  const videoMatches =
    html.matchAll(
      /video\[(\d+)\]\s*=\s*'<iframe[^>]+src="([^"]+)"/g,
    );

  for (
    const match of videoMatches
  ) {
    const index =
      Number.parseInt(
        match[1],
        10,
      );

    const iframeUrl =
      match[2];

    if (!iframeUrl) {
      continue;
    }

    const fullUrl =
      iframeUrl.startsWith(
        "http",
      )
        ? iframeUrl
        : `https://jkanime.net${iframeUrl}`;

    const name =
      index === 0
        ? "Desu"
        : index === 1
        ? "Magi"
        : `JKAnime ${index}`;

    const key =
      fullUrl
        .trim()
        .replace(
          /\/+$/,
          "",
        )
        .toLowerCase();

    if (!key) {
      continue;
    }

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    servers.push({
      name,
      url: fullUrl,
      type: "iframe",
    });
  }

  // --------------------------------------------------------
  // FALLBACK PARA VARIANTES DE COMILLAS
  // --------------------------------------------------------

  if (
    servers.length < 2
  ) {
    const flexibleRegex =
      /video\[\s*(\d+)\s*\]\s*=\s*(['"])([\s\S]*?)\2/g;

    for (
      const match of html.matchAll(
        flexibleRegex,
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
          /<iframe[^>]+src=["']([^"']+)["']/i,
        );

      if (!srcMatch) {
        continue;
      }

      const iframeUrl =
        srcMatch[1];

      if (!iframeUrl) {
        continue;
      }

      const fullUrl =
        iframeUrl.startsWith(
          "http",
        )
          ? iframeUrl
          : `https://jkanime.net${iframeUrl}`;

      const name =
        index === 0
          ? "Desu"
          : index === 1
          ? "Magi"
          : `JKAnime ${index}`;

      const key =
        fullUrl
          .trim()
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

      servers.push({
        name,
        url: fullUrl,
        type: "iframe",
      });
    }
  }

  // --------------------------------------------------------
  // 2. var servers = [...]
  //
  // YOURUPLOAD / MEGA
  // --------------------------------------------------------

  const serversMatch =
    html.match(
      /var\s+servers\s*=\s*(\[[\s\S]*?\]);/,
    );

  if (serversMatch) {
    try {
      const rawList =
        JSON.parse(
          serversMatch[1],
        );

      if (
        Array.isArray(
          rawList,
        )
      ) {
        for (
          const item of rawList
        ) {
          const serverName =
            String(
              item?.server ||
                "",
            ).trim();

          const remote =
            String(
              item?.remote ||
                "",
            ).trim();

          if (
            !serverName ||
            !remote
          ) {
            continue;
          }

          // --------------------------------------------------
          // YOURUPLOAD
          // --------------------------------------------------

          if (
            serverName
              .toLowerCase() ===
            "yourupload"
          ) {
            const playerIframe =
              `https://jkanime.net/jkplayer/c1?u=${encodeURIComponent(
                remote,
              )}&s=yourupload`;

            const key =
              playerIframe
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

            servers.push({
              name:
                "YourUpload",
              url:
                playerIframe,
              type:
                "iframe",
            });

            continue;
          }

          // --------------------------------------------------
          // MEGA
          // --------------------------------------------------

          if (
            serverName
              .toLowerCase() ===
            "mega"
          ) {
            let realUrl =
              "";

            try {
              realUrl =
                atob(
                  remote,
                );
            } catch {
              try {
                realUrl =
                  atob(
                    remote +
                      "==",
                  );
              } catch {
                realUrl =
                  "";
              }
            }

            if (
              !realUrl ||
              !/^https?:\/\//i.test(
                realUrl,
              )
            ) {
              continue;
            }

            const key =
              realUrl
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

            servers.push({
              name:
                "Mega",
              url:
                realUrl,
              type:
                "mp4",
            });
          }
        }
      }
    } catch (error) {
      console.log(
        "⚠️ JKAnime servers JSON:",
        error,
      );
    }
  }

  console.log(
    "✅ JKAnime servers:",
    servers.map(
      server => ({
        name:
          server.name,
        type:
          server.type,
        url:
          server.url,
      }),
    ),
  );

  return servers;
}


// ----------------------------------------------------------
// SUBTÍTULOS
// ----------------------------------------------------------

export async function getJKAnimeSubtitles(
  slug: string,
  episode: number,
): Promise<JKSubtitle[]> {
  const url =
    `https://jkanime.net/${slug}/${episode}/`;

  const html =
    await fetchHtml(url);

  if (!html) {
    return [];
  }

  const subs: JKSubtitle[] = [];
  const seen = new Set<string>();

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
        /\bdata-url=["']([^"']+)["']/i,
      );

    const langMatch =
      attrs.match(
        /\bdata-language=["']([^"']*)["']/i,
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

    const isSpanish =
      lang === "es" ||
      lang.includes(
        "spa",
      ) ||
      lang.includes(
        "español",
      ) ||
      lang.includes(
        "spanish",
      );

    if (!isSpanish) {
      continue;
    }

    const subUrl =
      String(
        urlMatch[1],
      )
        .replace(
          /&amp;/gi,
          "&",
        )
        .replace(
          /\\\//g,
          "/",
        )
        .trim();

    if (!subUrl) {
      continue;
    }

    if (
      seen.has(subUrl)
    ) {
      continue;
    }

    seen.add(
      subUrl,
    );

    subs.push({
      lang:
        "Español",
      url:
        subUrl,
    });
  }

  return subs;
}
