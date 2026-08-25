import { fetchHtml } from "./fetcher";

const BASE =
  "https://animeflv.or.at";

export interface AnimeFLVServer {
  name: string;
  url: string;
  type: "iframe";
}

interface EpisodeEntry {
  post_id?: number;
  permalink?: string;
  number?: number;
  range?: number;
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
      " ",
    )
    .trim();
}

function slugify(
  value: string,
): string {
  return normalizeTitle(
    value,
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
      "",
    );
}

function cleanHtml(
  value: string,
): string {
  return String(value || "")
    .replace(
      /<[^>]*>/g,
      " ",
    )
    .replace(
      /&amp;/gi,
      "&",
    )
    .replace(
      /&quot;/gi,
      '"',
    )
    .replace(
      /&#39;/gi,
      "'",
    )
    .replace(
      /&#x27;/gi,
      "'",
    )
    .replace(
      /&nbsp;/gi,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

/*
 * Intenta obtener la página /anime/slug/
 * directamente.
 */
async function getAnimePage(
  title: string,
): Promise<{
  html: string;
  url: string;
} | null> {
  const slug =
    slugify(title);

  if (!slug) {
    return null;
  }

  const url =
    `${BASE}/anime/${slug}/`;

  const html =
    await fetchHtml(url);

  if (
    html &&
    html.length > 1000
  ) {
    return {
      html,
      url,
    };
  }

  return null;
}

/*
 * Fallback: búsqueda WordPress.
 */
async function searchAnimeFLV(
  title: string,
): Promise<{
  html: string;
  url: string;
} | null> {
  const query =
    encodeURIComponent(
      title,
    );

  const searchUrl =
    `${BASE}/?s=${query}`;

  const html =
    await fetchHtml(
      searchUrl,
    );

  if (!html) {
    return null;
  }

  /*
   * Primero buscamos links de /anime/
   */
  const animeRegex =
    /<a\b[^>]*href=["'](https?:\/\/animeflv\.or\.at\/anime\/[^"']+\/)["'][^>]*>([\s\S]*?)<\/a>/gi;

  const candidates: Array<{
    url: string;
    title: string;
    score: number;
  }> = [];

  let match: RegExpExecArray | null;

  while (
    (match =
      animeRegex.exec(html)) !== null
  ) {
    const url =
      match[1];

    const candidateTitle =
      cleanHtml(
        match[2],
      );

    if (!candidateTitle) {
      continue;
    }

    const A =
      normalizeTitle(title);

    const B =
      normalizeTitle(
        candidateTitle,
      );

    let score = 0;

    if (A === B) {
      score = 100;
    } else if (
      B.includes(A) ||
      A.includes(B)
    ) {
      score = 90;
    } else {
      const tokens =
        new Set(
          A.split(" "),
        );

      const candidateTokens =
        new Set(
          B.split(" "),
        );

      let common = 0;

      for (
        const token of
        tokens
      ) {
        if (
          token.length > 2 &&
          candidateTokens.has(
            token,
          )
        ) {
          common++;
        }
      }

      score =
        (common /
          Math.max(
            1,
            tokens.size,
          )) *
        80;
    }

    candidates.push({
      url,
      title:
        candidateTitle,
      score,
    });
  }

  candidates.sort(
    (a, b) =>
      b.score -
      a.score,
  );

  if (
    !candidates.length
  ) {
    return null;
  }

  const best =
    candidates[0];

  if (
    best.score < 55
  ) {
    return null;
  }

  const animeHtml =
    await fetchHtml(
      best.url,
    );

  if (!animeHtml) {
    return null;
  }

  return {
    html: animeHtml,
    url: best.url,
  };
}

/*
 * Obtiene:
 *
 * <script type="application/json"
 * class="animeflv-episodes-data">
 *
 * [...]
 *
 * </script>
 */
function extractEpisodes(
  html: string,
): EpisodeEntry[] {
  const regex =
    /<script\b[^>]*class=["'][^"']*animeflv-episodes-data[^"']*["'][^>]*>([\s\S]*?)<\/script>/i;

  const match =
    html.match(regex);

  if (!match) {
    return [];
  }

  const raw =
    match[1].trim();

  try {
    const parsed =
      JSON.parse(raw);

    if (
      Array.isArray(parsed)
    ) {
      return parsed;
    }
  } catch {}

  return [];
}

/*
 * Extrae los botones:
 *
 * <button
 *   data-src="BASE64"
 * >
 *
 * El sitio actual usa exactamente este
 * mecanismo para cargar el iframe.
 */
function extractServers(
  html: string,
): AnimeFLVServer[] {
  const result:
    AnimeFLVServer[] =
    [];

  const regex =
    /<button\b[^>]*data-src=["']([^"']+)["'][^>]*>([\s\S]*?)<\/button>/gi;

  let match: RegExpExecArray | null;

  const allowed =
    new Set([
      "hls",
      "byse",
      "mega",
      "mp4upload",
    ]);

  const seen =
    new Set<string>();

  while (
    (match =
      regex.exec(html)) !== null
  ) {
    const encoded =
      match[1];

    const label =
      cleanHtml(
        match[2],
      );

    const normalized =
      label.toLowerCase();

    /*
     * Voe eliminado.
     */
    if (
      normalized ===
      "voe"
    ) {
      continue;
    }

    if (
      !allowed.has(
        normalized,
      )
    ) {
      continue;
    }

    let url = "";

    try {
      url =
        atob(encoded);
    } catch {
      continue;
    }

    if (
      !/^https?:\/\//i.test(
        url,
      )
    ) {
      continue;
    }

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

    result.push({
      name: label,
      url,
      type: "iframe",
    });
  }

  /*
   * El orden que nos interesa.
   */
  const priority =
    (name: string) => {
      const n =
        name.toLowerCase();

      if (n === "hls") {
        return 0;
      }

      if (n === "byse") {
        return 1;
      }

      if (n === "mega") {
        return 2;
      }

      if (
        n === "mp4upload"
      ) {
        return 3;
      }

      return 99;
    };

  result.sort(
    (a, b) =>
      priority(a.name) -
      priority(b.name),
  );

  return result;
}

export async function getAnimeFLVServers(
  title: string,
  episode: number,
): Promise<AnimeFLVServer[]> {
  /*
   * 1. Intento directo.
   */
  let anime =
    await getAnimePage(
      title,
    );

  /*
   * 2. Fallback por búsqueda.
   */
  if (!anime) {
    anime =
      await searchAnimeFLV(
        title,
      );
  }

  if (!anime) {
    return [];
  }

  /*
   * 3. Sacamos el permalink real
   * del episodio.
   */
  const episodes =
    extractEpisodes(
      anime.html,
    );

  const target =
    episodes.find(
      item =>
        Number(
          item.number,
        ) === episode,
    );

  if (
    !target?.permalink
  ) {
    return [];
  }

  /*
   * 4. Entramos directamente al
   * permalink que AnimeFLV nos dio.
   *
   * Esto evita inventar la fecha.
   */
  const episodeHtml =
    await fetchHtml(
      target.permalink,
    );

  if (!episodeHtml) {
    return [];
  }

  /*
   * 5. Extraemos los players.
   */
  return extractServers(
    episodeHtml,
  );
}
