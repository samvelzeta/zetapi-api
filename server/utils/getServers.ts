import { getJKAnimeServers, getJKAnimeSubtitles } from "./jkanime";
import { findJKAnimeSlug } from "./jkSearch";
import { getAnimeAV1Embeds } from "./animeav1";
import { getAnimeX2Servers } from "./animex2";
import { getAnimeMetadata } from "./metadata";
import { getAnimeD23Servers } from "./animed23";
import {
  findAnimeFLVSlug,
  getAnimeFLVServers,
} from "./animeflv";
import { matchScore } from "./titleMatcher";
import { getAnimeYTServers } from "./animeyt";

const PROXY = "/proxy-zilla?url=";

export interface ServerResult {
  name: string;
  type: "Externo";
  embed: string;
}

interface SearchTitleSet {
  originalSlug: string;
  titles: string[];
  malId: number | null;
}

/**
 * Agregador principal.
 *
 * IMPORTANTE:
 * - Las funciones de extracción de cada proveedor se mantienen.
 * - Lo que cambia aquí es el RESOLVER DE CANDIDATOS:
 *   usamos más variantes de título/temporada y las ordenamos
 *   antes de consultar cada proveedor.
 * - No se toca la estructura que devuelve la API.
 */
export async function getAllServers({
  slug,
  number,
  title,
  anilistId,
  env,
}: {
  slug: string;
  number: number;
  title?: string;
  anilistId?: number;
  env?: any;
}): Promise<ServerResult[]> {
  const allServers: ServerResult[] = [];

  const searchTitle = String(title || slug || "").trim();

  let meta: Awaited<ReturnType<typeof getAnimeMetadata>> = {
    titles: [],
    malId: null,
    anilistId: null,
  };

  try {
    meta = await getAnimeMetadata(searchTitle);
  } catch (error) {
    console.log("⚠️ Error obteniendo metadata:", error);
  }

  const allTitles =
    buildSearchTitles(
      slug,
      searchTitle,
      meta.titles,
    );

  const searchData: SearchTitleSet = {
    originalSlug: slug,
    titles: allTitles,
    malId: meta.malId,
  };

  // ============================================================
  // 1. ANIMEX2
  // ============================================================

  const animeX2Candidates =
    buildProviderCandidates(searchData);

  console.log(
    `🔎 AnimeX2: ${animeX2Candidates.length} candidatos de slug`,
  );

  const triedX2 = new Set<string>();

  for (const candidate of animeX2Candidates) {
    const key = candidate.toLowerCase();

    if (triedX2.has(key)) {
      continue;
    }

    triedX2.add(key);

    try {
      const servers =
        await getAnimeX2Servers(
          candidate,
          number,
        );

      if (servers.length) {
        for (const server of servers) {
          if (!server?.url) {
            continue;
          }

          allServers.push({
            name: "",
            type: "Externo",
            embed: server.url,
          });
        }

        console.log(
          `✅ AnimeX2 encontró ${servers.length} servers con slug "${candidate}"`,
        );

        break;
      }
    } catch (error) {
      console.log(
        `⚠️ AnimeX2 error (${candidate}):`,
        error,
      );
    }
  }

  // ============================================================
  // 2. ANIMEAV1
  // ============================================================

  const animeAV1Candidates =
    buildProviderCandidates(searchData);

  const triedAV1 = new Set<string>();

  for (const candidate of animeAV1Candidates) {
    const key = candidate.toLowerCase();

    if (triedAV1.has(key)) {
      continue;
    }

    triedAV1.add(key);

    try {
      const embeds =
        await getAnimeAV1Embeds(
          candidate,
          number,
        );

      if (embeds.length) {
        for (const embed of embeds) {
          if (!embed?.url) {
            continue;
          }

          /*
           * Se conserva EXACTAMENTE el comportamiento
           * que ya tenías para AV1:
           * Mega directo, resto por proxy-zilla.
           */
          const finalUrl =
            embed.server === "Mega"
              ? embed.url
              : `${PROXY}${encodeURIComponent(
                  embed.url,
                )}`;

          allServers.push({
            name: "",
            type: "Externo",
            embed: finalUrl,
          });
        }

        console.log(
          `✅ AnimeAV1 encontró ${embeds.length} servers con slug "${candidate}"`,
        );

        break;
      }
    } catch (error) {
      console.log(
        `⚠️ AnimeAV1 error (${candidate}):`,
        error,
      );
    }
  }

  // ============================================================
  // 3. ANIMED23
  // ============================================================

  const triedD23 = new Set<string>();

  for (const candidate of buildProviderCandidates(searchData)) {
    const key = candidate.toLowerCase();

    if (triedD23.has(key)) {
      continue;
    }

    triedD23.add(key);

    try {
      const servers =
        await getAnimeD23Servers(
          candidate,
          number,
        );

      if (servers.length) {
        for (const server of servers) {
          if (!server?.url) {
            continue;
          }

          allServers.push({
            name: "",
            type: "Externo",
            embed: server.url,
          });
        }

        console.log(
          `✅ AnimeD23 encontró ${servers.length} servers con slug "${candidate}"`,
        );

        break;
      }
    } catch (error) {
      console.log(
        `⚠️ AnimeD23 error (${candidate}):`,
        error,
      );
    }
  }

  // ============================================================
  // 4. ANIMEFLV
  // ============================================================

  console.log(
    `🔎 AnimeFLV: buscando "${searchTitle}" episodio ${number}`,
  );

  const animeFLVTried =
    new Set<string>();

  /*
   * AnimeFLV tiene su propio buscador real:
   * título -> resultados -> slug -> episodio -> data-src.
   *
   * No hacemos aquí generación ciega de URL para la página.
   * findAnimeFLVSlug se encarga de eso.
   */
  for (const candidateTitle of allTitles) {
    const cleanTitle =
      String(candidateTitle || "").trim();

    if (!cleanTitle) {
      continue;
    }

    const titleKey =
      normalizeText(cleanTitle);

    if (animeFLVTried.has(titleKey)) {
      continue;
    }

    animeFLVTried.add(titleKey);

    try {
      const resolvedSlug =
        await findAnimeFLVSlug(
          cleanTitle,
          allTitles,
          env,
        );

      console.log(
        `🔎 AnimeFLV slug "${cleanTitle}": ${
          resolvedSlug || "NO ENCONTRADO"
        }`,
      );

      if (!resolvedSlug) {
        continue;
      }

      const servers =
        await getAnimeFLVServers(
          resolvedSlug,
          number,
          allTitles,
          env,
        );

      console.log(
        `🎬 AnimeFLV "${resolvedSlug}" episodio ${number}: ${servers.length} servers`,
      );

      if (servers.length) {
        for (const server of servers) {
          if (!server?.embed) {
            continue;
          }

          allServers.push({
            name: server.name || "",
            type: "Externo",
            embed: server.embed,
          });
        }

        break;
      }
    } catch (error) {
      console.log(
        `⚠️ AnimeFLV error ("${cleanTitle}"):`,
        error,
      );
    }
  }

  // ============================================================
  // 5. JKANIME
  // ============================================================

  try {
    const jkSlug =
      await findJKAnimeSlug(
        searchTitle,
        env,
        allTitles,
        meta.malId,
      );

    const targetSlug =
      jkSlug || slug;

    console.log(
      `🔎 JKAnime slug: ${targetSlug}`,
    );

    const jkServers =
      await getJKAnimeServers(
        targetSlug,
        number,
      );

    for (const server of jkServers) {
      if (!server?.url) {
        continue;
      }

      allServers.push({
        name: "",
        type: "Externo",
        embed: server.url,
      });
    }
  } catch (error) {
    console.log(
      "⚠️ JKAnime error:",
      error,
    );
  }

  // ============================================================
  // 6. ANIMEYT
  // ============================================================
  //
  // AnimeYT publica el reproductor intermedio en:
  // mytsumi.com/multiplayer/options.php?server=multi&value=...
  //
  // El scraper animeyt.ts se encarga de:
  // episodio -> iframe/data-src -> Mytsumi -> players.
  // No modificamos ninguno de los scrapers anteriores.
  // ============================================================

  try {
    const animeYTCandidates =
      buildProviderCandidates(searchData);

    const triedAnimeYT =
      new Set<string>();

    for (const candidate of animeYTCandidates) {
      const key =
        candidate.toLowerCase();

      if (triedAnimeYT.has(key)) {
        continue;
      }

      triedAnimeYT.add(key);

      try {
        const servers =
          await getAnimeYTServers(
            candidate,
            number,
          );

        if (!servers.length) {
          continue;
        }

        for (const server of servers) {
          if (!server?.url) {
            continue;
          }

          allServers.push({
            name: server.name || "",
            type: "Externo",
            embed: server.url,
          });
        }

        console.log(
          `✅ AnimeYT encontró ${servers.length} servers con slug "${candidate}"`,
        );

        break;
      } catch (error) {
        console.log(
          `⚠️ AnimeYT error (${candidate}):`,
          error,
        );
      }
    }
  } catch (error) {
    console.log(
      "⚠️ AnimeYT error general:",
      error,
    );
  }

  // ============================================================
  // DEDUPLICAR
  // ============================================================

  const seen =
    new Set<string>();

  const unique: ServerResult[] = [];

  for (const server of allServers) {
    if (!server?.embed) {
      continue;
    }

    const normalized =
      normalizeEmbedForDedup(
        server.embed,
      );

    if (
      !normalized ||
      seen.has(normalized)
    ) {
      continue;
    }

    seen.add(normalized);

    unique.push({
      name: server.name || "",
      type: "Externo",
      embed: server.embed,
    });
  }

  // ============================================================
  // NOMBRAR SERVIDORES
  // ============================================================

  const finalServers =
    unique
      .slice(0, 15)
      .map(
        (server, index) => ({
          ...server,
          name:
            getFinalServerName(
              server.embed,
              index,
              server.name,
            ),
        }),
      );

  console.log(
    `🎬 Total servers encontrados: ${finalServers.length}`,
  );

  for (
    const server of finalServers
  ) {
    console.log(
      `   → ${server.name}: ${server.embed}`,
    );
  }

  return finalServers;
}

// ============================================================
// CONSTRUCCIÓN DE TÍTULOS DE BÚSQUEDA
// ============================================================

function buildSearchTitles(
  slug: string,
  title: string,
  metadataTitles: string[],
): string[] {
  const values = [
    slug,
    title,
    ...metadataTitles,
  ];

  const result: string[] = [];
  const seen =
    new Set<string>();

  const add = (
    value: string,
  ) => {
    const clean =
      String(value || "")
        .replace(/\s+/g, " ")
        .trim();

    if (!clean) {
      return;
    }

    const key =
      normalizeText(clean);

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(clean);
  };

  for (const value of values) {
    add(value);
  }

  /*
   * Agregamos formas sin información
   * de temporada/parte.
   */
  for (const value of values) {
    for (const variant of removeSeasonMarkers(value)) {
      add(variant);
    }
  }

  /*
   * Agregamos variantes con números/romanos.
   */
  for (const value of values) {
    for (const variant of expandSeasonMarkers(value)) {
      add(variant);
    }
  }

  /*
   * Para títulos muy largos:
   * conservamos el inicio como fallback.
   */
  for (const value of values) {
    const words =
      normalizeTitleForSlug(value)
        .split("-")
        .filter(Boolean);

    if (words.length >= 3) {
      add(
        words
          .slice(0, 3)
          .join(" "),
      );
    }

    if (words.length >= 4) {
      add(
        words
          .slice(0, 4)
          .join(" "),
      );
    }
  }

  return result.slice(0, 80);
}

// ============================================================
// CANDIDATOS DE SLUG
// ============================================================

function buildProviderCandidates(
  searchData: SearchTitleSet,
): string[] {
  const candidates =
    new Set<string>();

  const add = (
    value: string,
  ) => {
    const slug =
      normalizeTitleForSlug(
        value,
      );

    if (!slug) {
      return;
    }

    candidates.add(slug);
  };

  /*
   * PRIORIDAD 1:
   * el slug recibido por la aplicación.
   *
   * Esto mantiene el comportamiento
   * rápido de la versión anterior.
   */
  add(
    searchData.originalSlug,
  );

  /*
   * PRIORIDAD 2:
   * títulos reales provenientes de metadata.
   */
  for (const title of searchData.titles) {
    add(title);
  }

  /*
   * PRIORIDAD 3:
   * todas las transformaciones de cada título.
   */
  for (const title of searchData.titles) {
    for (
      const variant of buildSlugVariants(
        title,
      )
    ) {
      add(variant);
    }
  }

  /*
   * Orden inteligente.
   *
   * No elimina candidatos.
   * Solo intenta antes los que más se
   * parecen a los títulos conocidos.
   */
  return [...candidates]
    .map(
      slug => ({
        slug,
        score:
          scoreCandidateSlug(
            slug,
            searchData,
          ),
      }),
    )
    .sort(
      (a, b) =>
        b.score - a.score,
    )
    .map(item => item.slug)
    .slice(0, 40);
}

// ============================================================
// VARIANTES DE SLUG
// ============================================================

function buildSlugVariants(
  title: string,
): string[] {
  const result =
    new Set<string>();

  const base =
    normalizeTitleForSlug(
      title,
    );

  if (!base) {
    return [];
  }

  result.add(base);

  /*
   * Sin season / temporada / part / cour.
   */
  for (
    const variant of removeSeasonMarkers(
      title,
    )
  ) {
    const slug =
      normalizeTitleForSlug(
        variant,
      );

    if (slug) {
      result.add(slug);
    }
  }

  /*
   * Conversión de números a romanos
   * y viceversa para sufijos finales.
   */
  for (
    const variant of expandSeasonMarkers(
      title,
    )
  ) {
    const slug =
      normalizeTitleForSlug(
        variant,
      );

    if (slug) {
      result.add(slug);
    }
  }

  /*
   * Si hay "-" o ":" en el nombre,
   * probamos formas compactas.
   */
  const simplified =
    base
      .replace(
        /-(tv|ova|ona|ona\s*)$/i,
        "",
      );

  if (
    simplified &&
    simplified !== base
  ) {
    result.add(
      simplified,
    );
  }

  /*
   * Títulos largos:
   * primeras 3-5 palabras.
   */
  const words =
    base
      .split("-")
      .filter(Boolean);

  for (
    let count = 3;
    count <= 5;
    count++
  ) {
    if (
      words.length >= count
    ) {
      result.add(
        words
          .slice(0, count)
          .join("-"),
      );
    }
  }

  /*
   * Forma sin separadores.
   */
  if (
    words.length >= 2
  ) {
    result.add(
      words.join(""),
    );
  }

  return [...result];
}

// ============================================================
// ELIMINAR MARCADORES DE TEMPORADA
// ============================================================

function removeSeasonMarkers(
  value: string,
): string[] {
  const text =
    String(value || "")
      .trim();

  if (!text) {
    return [];
  }

  const results =
    new Set<string>();

  const add =
    (candidate: string) => {
      const clean =
        candidate
          .replace(
            /\s+/g,
            " ",
          )
          .replace(
            /[-_:]+/g,
            " ",
          )
          .trim();

      if (clean) {
        results.add(clean);
      }
    };

  /*
   * Season 2 / temporada 2 / part 2 / cour 2
   */
  add(
    text.replace(
      /\b(?:season|temporada|part|parte|cour)\s*[-_:]?\s*(?:\d+|[ivxlcdm]+)\b/gi,
      "",
    ),
  );

  /*
   * 2nd season / 2nd temporada / II season
   */
  add(
    text.replace(
      /\b(?:\d+(?:st|nd|rd|th)|[ivxlcdm]+)\s+(?:season|temporada)\b/gi,
      "",
    ),
  );

  /*
   * S2 / S03 al final o separado.
   */
  add(
    text.replace(
      /\bS\d+\b/gi,
      "",
    ),
  );

  /*
   * " - 2" / " II" al final.
   *
   * SOLO como fallback y únicamente
   * cuando parece un sufijo de temporada.
   */
  add(
    text.replace(
      /(?:\s*[-:]\s*|\s+)(?:\d+|[ivxlcdm]{1,5})$/i,
      "",
    ),
  );

  return [
    ...results,
  ];
}

// ============================================================
// EXPANDIR MARCADORES DE TEMPORADA
// ============================================================

function expandSeasonMarkers(
  value: string,
): string[] {
  const text =
    String(value || "")
      .trim();

  if (!text) {
    return [];
  }

  const results =
    new Set<string>();

  const add =
    (candidate: string) => {
      const clean =
        candidate
          .replace(
            /\s+/g,
            " ",
          )
          .trim();

      if (clean) {
        results.add(clean);
      }
    };

  const romanToArabic: Record<
    string,
    string
  > = {
    i: "1",
    ii: "2",
    iii: "3",
    iv: "4",
    v: "5",
    vi: "6",
    vii: "7",
    viii: "8",
    ix: "9",
    x: "10",
  };

  const arabicToRoman: Record<
    string,
    string
  > = {
    "1": "I",
    "2": "II",
    "3": "III",
    "4": "IV",
    "5": "V",
    "6": "VI",
    "7": "VII",
    "8": "VIII",
    "9": "IX",
    "10": "X",
  };

  const match =
    text.match(
      /\b(season|temporada|part|parte|cour)\s*[-_:]?\s*(\d+|[ivxlcdm]+)\b/i,
    );

  if (match) {
    const word =
      match[1];

    const number =
      match[2];

    const numeric =
      romanToArabic[
        number.toLowerCase()
      ] || number;

    const roman =
      arabicToRoman[number] ||
      number.toUpperCase();

    if (
      numeric !== number
    ) {
      add(
        text.replace(
          match[0],
          `${word} ${numeric}`,
        ),
      );
    }

    if (
      roman !== number
    ) {
      add(
        text.replace(
          match[0],
          `${word} ${roman}`,
        ),
      );
    }

    add(
      text.replace(
        match[0],
        `tv-${numeric}`,
      ),
    );

    add(
      text.replace(
        match[0],
        `tv-${roman}`,
      ),
    );
  }

  const short =
    text.match(
      /\bS(\d+)\b/i,
    );

  if (short) {
    const number =
      short[1];

    const roman =
      arabicToRoman[number] ||
      number;

    add(
      text.replace(
        short[0],
        `season ${number}`,
      ),
    );

    if (
      roman !== number
    ) {
      add(
        text.replace(
          short[0],
          `season ${roman}`,
        ),
      );
    }
  }

  /*
   * Para nombres que terminan en "-3",
   * " 3", " III":
   * probamos las formas explícitas.
   */
  const suffix =
    text.match(
      /(?:\s*[-_:]\s*|\s+)(\d+|[ivxlcdm]{1,5})$/i,
    );

  if (suffix) {
    const token =
      suffix[1];

    const numeric =
      romanToArabic[
        token.toLowerCase()
      ] || token;

    const roman =
      arabicToRoman[token] ||
      token.toUpperCase();

    const base =
      text.slice(
        0,
        suffix.index,
      ).trim();

    if (base) {
      add(
        `${base} season ${numeric}`,
      );

      add(
        `${base} temporada ${numeric}`,
      );

      add(
        `${base} season ${roman}`,
      );

      add(
        `${base} ${numeric}`,
      );

      add(
        `${base} ${roman}`,
      );

      add(
        `${base}-tv-${numeric}`,
      );
    }
  }

  return [
    ...results,
  ];
}

// ============================================================
// SCORING DE SLUG
// ============================================================

function scoreCandidateSlug(
  candidateSlug: string,
  data: SearchTitleSet,
): number {
  const candidateTitle =
    candidateSlug.replace(
      /-/g,
      " ",
    );

  let best =
    matchScore(
      candidateTitle,
      candidateSlug,
      null,
      data.titles,
      data.malId,
    );

  /*
   * El slug que llega del frontend
   * debe conservar prioridad.
   */
  if (
    normalizeTitleForSlug(
      data.originalSlug,
    ) === candidateSlug
  ) {
    best += 15;
  }

  /*
   * Preferimos las versiones más completas
   * sobre truncamientos de 3/4 palabras.
   */
  const tokenCount =
    candidateSlug
      .split("-")
      .filter(Boolean)
      .length;

  if (tokenCount >= 5) {
    best += 2;
  }

  return best;
}

// ============================================================
// NORMALIZACIÓN
// ============================================================

function normalizeText(
  text: string,
): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[’']/g,
      "",
    )
    .replace(
      /[^a-z0-9\s]/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function normalizeTitleForSlug(
  text: string,
): string {
  return normalizeText(
    text,
  )
    .replace(
      /\b(?:the|a|an)\b/g,
      " ",
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

// ============================================================
// NOMBRES DE SERVIDOR
// ============================================================

function getFinalServerName(
  embed: string,
  index: number,
  originalName = "",
): string {
  const url =
    embed.toLowerCase();

  const sourceName =
    String(
      originalName || "",
    ).trim();

  if (
    sourceName &&
    sourceName !== "Externo"
  ) {
    if (
      sourceName.toLowerCase() ===
        "zilla" &&
      url.includes(
        "player.zilla-networks.com",
      )
    ) {
      return "Zilla";
    }

    if (
      sourceName.toLowerCase() ===
        "mp4upload" &&
      url.includes(
        "mp4upload",
      )
    ) {
      return "MP4Upload";
    }

    if (
      sourceName.toLowerCase() ===
        "mega" &&
      url.includes(
        "mega.nz",
      )
    ) {
      return "Mega";
    }

    if (
      sourceName.toLowerCase() ===
        "byse" &&
      url.includes(
        "byse",
      )
    ) {
      return "Byse";
    }
  }

  // JKAnime
  if (
    url.includes(
      "jkanime.net/jkplayer/umv",
    )
  ) {
    return "Magi";
  }

  if (
    url.includes(
      "jkanime.net/jkplayer/um",
    )
  ) {
    return "Desu";
  }

  // Zilla
  if (
    url.includes(
      "player.zilla-networks.com",
    )
  ) {
    return "Zilla";
  }

  // MP4Upload
  if (
    url.includes(
      "mp4upload",
    )
  ) {
    return "MP4Upload";
  }

  // Mytsumi
  if (
    url.includes(
      "mytsumi",
    )
  ) {
    return "Mytsumi";
  }

  // Mega
  if (
    url.includes(
      "mega.nz",
    )
  ) {
    return "Mega";
  }

  // Archive
  if (
    url.includes(
      "archive.org",
    )
  ) {
    return "Archive";
  }

  // Byse
  if (
    url.includes(
      "byse",
    )
  ) {
    return "Byse";
  }

  // UPNShare
  if (
    url.includes(
      "upnshare",
    )
  ) {
    return "UPNShare";
  }

  return `Servidor ${index + 1}`;
}

// ============================================================
// DEDUPLICACIÓN
// ============================================================

function normalizeEmbedForDedup(
  value: string,
): string {
  try {
    const url =
      new URL(
        value,
      );

    return (
      `${url.protocol}//` +
      `${url.host}` +
      `${url.pathname}` +
      `${url.search}`
    ).toLowerCase();
  } catch {
    return value
      .trim()
      .toLowerCase();
  }
}

export async function getSubtitles(
  slug: string,
  episode: number,
) {
  return getJKAnimeSubtitles(
    slug,
    episode,
  );
}
