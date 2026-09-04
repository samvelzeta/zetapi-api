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

const PROXY = "/proxy-zilla?url=";

export interface ServerResult {
  name: string;
  type: "Externo";
  embed: string;
}

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

  const searchTitle = title || slug;

  let meta: any = {
    titles: [searchTitle],
    malId: undefined,
  };

  try {
    const metadata = await getAnimeMetadata(searchTitle);

    if (metadata) {
      meta = metadata;
    }
  } catch (error) {
    console.log("⚠️ Error obteniendo metadata:", error);
  }

  const allTitles: string[] =
    Array.isArray(meta.titles) && meta.titles.length
      ? meta.titles
      : [searchTitle];

  const tried = new Set<string>();

  // ============================================================
  // 1. ANIMEX2
  // ============================================================

  for (const t of allTitles) {
    const slugs = generateSlugVariants(t);

    for (const candidate of slugs) {
      const key = `animex2:${candidate}`;

      if (tried.has(key)) {
        continue;
      }

      tried.add(key);

      try {
        const servers = await getAnimeX2Servers(candidate, number);

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

        // Para el mismo proveedor no necesitamos probar más
        // slugs cuando ya encontramos servidores.
        if (servers.length) {
          break;
        }
      } catch (error) {
        console.log(
          `⚠️ AnimeX2 error (${candidate}):`,
          error,
        );
      }
    }
  }

  // ============================================================
  // 2. ANIMEAV1
  // ============================================================

  for (const t of allTitles) {
    const slugs = generateSlugVariants(t);

    for (const candidate of slugs) {
      const key = `animeav1:${candidate}`;

      if (tried.has(key)) {
        continue;
      }

      tried.add(key);

      try {
        const embeds = await getAnimeAV1Embeds(
          candidate,
          number,
        );

        for (const embed of embeds) {
          if (!embed?.url) {
            continue;
          }

          /*
           * Se conserva el comportamiento actual del proyecto:
           * Mega directo y el resto mediante proxy-zilla.
           */
          const finalUrl =
            embed.server === "Mega"
              ? embed.url
              : `${PROXY}${encodeURIComponent(embed.url)}`;

          allServers.push({
            name: "",
            type: "Externo",
            embed: finalUrl,
          });
        }

        if (embeds.length) {
          break;
        }
      } catch (error) {
        console.log(
          `⚠️ AnimeAV1 error (${candidate}):`,
          error,
        );
      }
    }
  }

  // ============================================================
  // 3. ANIMED23
  // ============================================================

  const d23Slugs = new Set<string>();

  d23Slugs.add(slug);

  for (const title of allTitles) {
    for (const candidate of generateSlugVariants(title)) {
      d23Slugs.add(candidate);
    }
  }

  for (const candidate of d23Slugs) {
    try {
      const servers = await getAnimeD23Servers(
        candidate,
        number,
      );

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

      if (servers.length) {
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
  //
  // IMPORTANTE:
  // AnimeFLV YA NO depende de que los proveedores anteriores
  // fallen. Siempre se intenta y sus servidores se agregan
  // al mismo array.
  //
  // Flujo:
  // título -> búsqueda AnimeFLV -> slug -> episodio ->
  // data-src Base64 -> URL de player -> servers[]
  // ============================================================

  console.log(
    `🔎 AnimeFLV: buscando "${searchTitle}" episodio ${number}`,
  );

  const animeFlvTitles = [
    searchTitle,
    ...allTitles,
  ];

  const animeFlvSeenTitles = new Set<string>();

  for (const candidateTitle of animeFlvTitles) {
    const cleanTitle = String(candidateTitle || "").trim();

    if (!cleanTitle) {
      continue;
    }

    const titleKey = cleanTitle.toLowerCase();

    if (animeFlvSeenTitles.has(titleKey)) {
      continue;
    }

    animeFlvSeenTitles.add(titleKey);

    try {
      const resolvedSlug = await findAnimeFLVSlug(
        cleanTitle,
        allTitles,
        env,
      );

      console.log(
        `🔎 AnimeFLV slug "${cleanTitle}": ${resolvedSlug || "NO ENCONTRADO"}`,
      );

      if (!resolvedSlug) {
        continue;
      }

      const animeFlvServers = await getAnimeFLVServers(
        resolvedSlug,
        number,
        allTitles,
        env,
      );

      console.log(
        `🎬 AnimeFLV "${resolvedSlug}" episodio ${number}: ${animeFlvServers.length} servers`,
      );

      for (const server of animeFlvServers) {
        if (!server?.embed) {
          continue;
        }

        allServers.push({
          name: server.name || "",
          type: "Externo",
          embed: server.embed,
        });
      }

      if (animeFlvServers.length) {
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
    const jkSlug = await findJKAnimeSlug(
      searchTitle,
      env,
      allTitles,
      meta.malId,
    );

    const targetSlug = jkSlug || slug;

    const jkServers = await getJKAnimeServers(
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
  // DEDUPLICAR
  // ============================================================

  const seen = new Set<string>();
  const unique: ServerResult[] = [];

  for (const server of allServers) {
    if (!server?.embed) {
      continue;
    }

    const normalized = normalizeEmbedForDedup(
      server.embed,
    );

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    unique.push(server);
  }

  // ============================================================
  // NOMBRAR SERVIDORES
  // ============================================================

  const finalServers = unique
    .slice(0, 15)
    .map((server, index) => ({
      ...server,
      name: getFinalServerName(
        server.embed,
        index,
        server.name,
      ),
    }));

  console.log(
    `🎬 Total servers encontrados: ${finalServers.length}`,
  );

  for (const server of finalServers) {
    console.log(
      `   → ${server.name}: ${server.embed}`,
    );
  }

  return finalServers;
}

// ============================================================
// NOMBRES
// ============================================================

function getFinalServerName(
  embed: string,
  index: number,
  originalName = "",
): string {
  const url = embed.toLowerCase();
  const sourceName = String(originalName || "").trim();

  // Respetar el nombre detectado por AnimeFLV cuando exista.
  if (sourceName && sourceName !== "Externo") {
    if (
      sourceName.toLowerCase() === "zilla" &&
      url.includes("player.zilla-networks.com")
    ) {
      return "Zilla";
    }

    if (
      sourceName.toLowerCase() === "mp4upload" &&
      url.includes("mp4upload")
    ) {
      return "MP4Upload";
    }

    if (
      sourceName.toLowerCase() === "mega" &&
      url.includes("mega.nz")
    ) {
      return "Mega";
    }

    if (
      sourceName.toLowerCase() === "byse" &&
      url.includes("byse")
    ) {
      return "Byse";
    }
  }

  // JKAnime
  if (url.includes("jkanime.net/jkplayer/umv")) {
    return "Magi";
  }

  if (url.includes("jkanime.net/jkplayer/um")) {
    return "Desu";
  }

  // AnimeFLV / Zilla
  if (url.includes("player.zilla-networks.com")) {
    return "Zilla";
  }

  // MP4Upload
  if (url.includes("mp4upload")) {
    return "MP4Upload";
  }

  // Mytsumi
  if (url.includes("mytsumi")) {
    return "Mytsumi";
  }

  // Mega
  if (url.includes("mega.nz")) {
    return "Mega";
  }

  // Archive
  if (url.includes("archive.org")) {
    return "Archive";
  }

  // Byse
  if (url.includes("byse")) {
    return "Byse";
  }

  // UPNShare
  if (url.includes("upnshare")) {
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
    const url = new URL(value);

    return (
      `${url.protocol}//` +
      `${url.host}` +
      `${url.pathname}` +
      `${url.search}`
    ).toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

// ============================================================
// SLUG VARIANTS
// ============================================================

function generateSlugVariants(
  title: string,
): string[] {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!base) {
    return [];
  }

  const variants = new Set<string>();

  variants.add(base);

  const noSeason = base
    .replace(
      /(season|temporada|part|parte|cour)-?\d+/gi,
      "",
    )
    .replace(
      /\d+(st|nd|rd|th)-?(season|temporada)/gi,
      "",
    )
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (noSeason && noSeason !== base) {
    variants.add(noSeason);
  }

  const words = base
    .split("-")
    .filter(word => word.length > 1);

  if (words.length >= 3) {
    variants.add(
      words.slice(0, 3).join("-"),
    );

    variants.add(
      words.slice(0, 4).join("-"),
    );
  }

  if (base.includes("season")) {
    variants.add(
      base.replace(/season/gi, "tv"),
    );
  }

  if (base.includes("tv")) {
    variants.add(
      base.replace(/tv/gi, "season"),
    );
  }

  return [...variants].slice(0, 8);
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
