import { fetchHtml } from "./fetcher";

export interface AnimeX2Server {
  name: string;
  url: string;
  type: "embed" | "download";
  language: string;
}

/**
 * AnimeX2 utiliza la serialización de Astro.
 *
 * Ejemplos:
 *
 * [0, "HLS"]                -> "HLS"
 * [1, 42]                   -> 42
 * [0, { ... }]              -> objeto
 * [1, [[0, {...}], ...]]    -> array
 *
 * El error del parser anterior era que solamente
 * desempaquetaba el primer nivel.
 */
function decodeAstroValue(value: any): any {
  if (Array.isArray(value)) {
    // Tupla Astro: [tipo, valor]
    if (
      value.length === 2 &&
      typeof value[0] === "number"
    ) {
      const type = value[0];
      const raw = value[1];

      switch (type) {
        case 0:
          // string u objeto serializado
          return decodeAstroValue(raw);

        case 1:
          // array serializado
          return decodeAstroValue(raw);

        case 2:
          // boolean
          return raw;

        case 3:
          // bigint / similar
          return raw;

        case 4:
          // Set
          return Array.isArray(raw)
            ? new Set(raw.map(decodeAstroValue))
            : raw;

        case 5:
          // Map
          return raw;

        case 6:
          // bigint
          return raw;

        case 7:
          // URL
          return raw;

        case 8:
          // Uint8Array
          return raw;

        case 9:
          // Uint16Array
          return raw;

        case 10:
          // Uint32Array
          return raw;

        case 11:
          // Infinity / special number
          return raw;

        default:
          return decodeAstroValue(raw);
      }
    }

    /*
     * Array normal:
     * decodificar todos sus hijos.
     */
    return value.map(
      decodeAstroValue,
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const result: Record<
      string,
      any
    > = {};

    for (
      const [key, child] of Object.entries(
        value,
      )
    ) {
      result[key] =
        decodeAstroValue(child);
    }

    return result;
  }

  return value;
}

/**
 * Convierte entidades HTML que aparecen
 * dentro del atributo props.
 */
function decodeHtmlEntities(
  value: string,
): string {
  return value
    .replace(
      /&quot;/gi,
      '"',
    )
    .replace(
      /&#34;/gi,
      '"',
    )
    .replace(
      /&amp;/gi,
      "&",
    )
    .replace(
      /&#38;/gi,
      "&",
    )
    .replace(
      /&lt;/gi,
      "<",
    )
    .replace(
      /&gt;/gi,
      ">",
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
      /&#x2F;/gi,
      "/",
    )
    .trim();
}

/**
 * Extrae específicamente el atributo props
 * del astro-island que corresponde a VideoPlayer.
 */
function extractVideoPlayerProps(
  html: string,
): Record<
  string,
  any
> | null {
  /*
   * No dependemos de un UID porque cambia
   * entre páginas/visitas.
   *
   * Buscamos exclusivamente:
   *
   * component-url="...VideoPlayer..."
   * props="..."
   */
  const regex =
    /<astro-island\b[^>]*component-url=["'][^"']*VideoPlayer[^"']*["'][^>]*props=["']([\s\S]*?)["'][^>]*>/i;

  const match =
    html.match(regex);

  if (!match) {
    console.log(
      "❌ AnimeX2: no se encontró el astro-island VideoPlayer",
    );

    return null;
  }

  const rawProps =
    decodeHtmlEntities(
      match[1],
    );

  if (!rawProps) {
    console.log(
      "❌ AnimeX2: props vacío",
    );

    return null;
  }

  try {
    return JSON.parse(
      rawProps,
    );
  } catch (error) {
    console.log(
      "❌ AnimeX2: JSON de props inválido",
      error,
    );

    return null;
  }
}

/**
 * Normaliza una URL.
 */
function normalizeUrl(
  value: unknown,
): string | null {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  let url =
    value.trim();

  if (!url) {
    return null;
  }

  /*
   * Reparar escapes comunes.
   */
  url = url
    .replace(
      /\\\//g,
      "/",
    )
    .replace(
      /\\"/g,
      '"',
    )
    .replace(
      /\\u0026/gi,
      "&",
    )
    .trim();

  if (
    url.startsWith("//")
  ) {
    url =
      `https:${url}`;
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
 * Extrae servidores desde el array `servers`
 * ya decodificado.
 */
function extractServersFromProps(
  props: Record<
    string,
    any
  >,
): AnimeX2Server[] {
  const serversRaw =
    props.servers;

  if (
    !Array.isArray(
      serversRaw,
    )
  ) {
    console.log(
      "❌ AnimeX2: props.servers no es un array",
    );

    return [];
  }

  const servers: AnimeX2Server[] =
    [];

  for (
    const item of serversRaw
  ) {
    /*
     * Después de decodeAstroValue()
     * debería quedar:
     *
     * {
     *   name: "HLS",
     *   url: "...",
     *   type: "embed",
     *   language: "SUB"
     * }
     */
    if (
      !item ||
      typeof item !==
        "object" ||
      Array.isArray(item)
    ) {
      continue;
    }

    const name =
      typeof item.name ===
      "string"
        ? item.name.trim()
        : "";

    const url =
      normalizeUrl(
        item.url,
      );

    const type =
      typeof item.type ===
      "string"
        ? item.type
        : "";

    const language =
      typeof item.language ===
      "string"
        ? item.language.trim() ||
          "SUB"
        : "SUB";

    /*
     * Solamente queremos reproductores.
     *
     * AnimeX2 también proporciona:
     * Mega download
     * MP4Upload download
     * 1Fichier download
     *
     * Esos se descartan.
     */
    if (
      type !==
      "embed"
    ) {
      continue;
    }

    if (!url) {
      continue;
    }

    servers.push({
      name:
        name ||
        "Servidor",
      url,
      type: "embed",
      language,
    });
  }

  return dedupeServers(
    servers,
  );
}

/**
 * Dedupe sin destruir parámetros
 * importantes de embeds.
 */
function dedupeServers(
  servers: AnimeX2Server[],
): AnimeX2Server[] {
  const seen =
    new Set<string>();

  const result:
    AnimeX2Server[] =
    [];

  for (
    const server of servers
  ) {
    const url =
      normalizeUrl(
        server.url,
      );

    if (!url) {
      continue;
    }

    /*
     * Para embeds NO eliminamos query/hash:
     * algunos reproductores los necesitan.
     */
    const key =
      url.toLowerCase();

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    result.push({
      ...server,
      url,
    });
  }

  return result;
}

/**
 * Orden recomendado.
 *
 * No elimina ninguno.
 */
function sortServers(
  servers: AnimeX2Server[],
): AnimeX2Server[] {
  const priority = (
    server: AnimeX2Server,
  ): number => {
    const url =
      server.url.toLowerCase();

    const name =
      server.name.toLowerCase();

    /*
     * HLS principal de AnimeX2.
     */
    if (
      name.includes("hls") ||
      url.includes(
        "player.zilla-networks.com",
      )
    ) {
      return 1;
    }

    /*
     * UPNShare
     */
    if (
      name.includes("upnshare") ||
      url.includes(
        "animeav1.uns.bio",
      )
    ) {
      return 2;
    }

    /*
     * Byse
     */
    if (
      name.includes("byse") ||
      url.includes(
        "byse",
      )
    ) {
      return 3;
    }

    /*
     * Mytsumi
     */
    if (
      name.includes("mytsumi") ||
      url.includes(
        "mytsumi",
      )
    ) {
      return 4;
    }

    /*
     * Mega
     */
    if (
      name.includes("mega") ||
      url.includes(
        "mega.nz",
      )
    ) {
      return 5;
    }

    /*
     * MP4Upload
     */
    if (
      name.includes(
        "mp4upload",
      ) ||
      url.includes(
        "mp4upload",
      )
    ) {
      return 6;
    }

    /*
     * Voe.
     *
     * Lo dejamos porque AnimeX2
     * realmente lo publica como embed.
     */
    if (
      name.includes("voe") ||
      url.includes("voe.")
    ) {
      return 7;
    }

    /*
     * Cualquier otro embed.
     */
    return 50;
  };

  return [...servers].sort(
    (a, b) =>
      priority(a) -
      priority(b),
  );
}

/**
 * Busca los servidores de un episodio
 * de AnimeX2.
 *
 * Ruta real:
 *
 * /ver/{slug}-{episode}
 */
export async function getAnimeX2Servers(
  slug: string,
  episode: number,
): Promise<AnimeX2Server[]> {
  if (
    !slug ||
    !Number.isFinite(
      Number(episode),
    )
  ) {
    console.log(
      "❌ AnimeX2: parámetros inválidos",
    );

    return [];
  }

  const normalizedEpisode =
    Number(episode);

  /*
   * No añadimos temporadas,
   * no modificamos el slug.
   *
   * El getServers.ts ya genera
   * las variantes.
   */
  const url =
    `https://animex2.com/ver/${slug}-${normalizedEpisode}`;

  console.log(
    `🔍 AnimeX2: ${url}`,
  );

  const html =
    await fetchHtml(
      url,
    );

  if (!html) {
    console.log(
      "❌ AnimeX2: HTML vacío",
    );

    return [];
  }

  /*
   * 1. Encontrar VideoPlayer
   */
  const rawProps =
    extractVideoPlayerProps(
      html,
    );

  if (!rawProps) {
    return [];
  }

  /*
   * 2. Deserializar TODA la estructura Astro.
   *
   * Este es el cambio importante.
   */
  const props =
    decodeAstroValue(
      rawProps,
    );

  if (
    !props ||
    typeof props !==
      "object"
  ) {
    console.log(
      "❌ AnimeX2: props no pudo ser decodificado",
    );

    return [];
  }

  /*
   * 3. Extraer embeds.
   */
  const servers =
    extractServersFromProps(
      props,
    );

  if (!servers.length) {
    console.log(
      "❌ AnimeX2: VideoPlayer encontrado pero no contiene embeds",
    );

    return [];
  }

  /*
   * 4. Ordenar sin eliminar servidores.
   */
  const ordered =
    sortServers(
      servers,
    );

  console.log(
    `🎯 AnimeX2: ${ordered.length} servidores embed encontrados`,
  );

  for (
    const server of ordered
  ) {
    console.log(
      `   → ${server.name}: ${server.url}`,
    );
  }

  return ordered;
}
