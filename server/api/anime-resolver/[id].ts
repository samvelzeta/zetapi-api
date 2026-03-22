import { searchAnime, getAnimeInfo } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  // 🌐 CORS
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key");

  // 🔥 PREFLIGHT
  if (event.method === "OPTIONS") {
    return { status: 200 };
  }

  // 🔐 API KEY
  const apiKey = getHeader(event, "x-api-key");

  const envKey =
    process.env.API_KEY ||
    event.context.cloudflare?.env?.API_KEY;

  if (!envKey || apiKey !== envKey) {
    throw createError({ statusCode: 401 });
  }

  const { id } = getRouterParams(event) as { id: string };

  // 🔥 1. OBTENER DATA DESDE ANILIST
  const anilist = await $fetch<any>("https://graphql.anilist.co", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: {
      query: `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            title {
              romaji
              english
              native
            }
            synonyms
          }
        }
      `,
      variables: {
        id: Number(id)
      }
    }
  }).catch(() => null);

  if (!anilist?.data?.Media) {
    throw createError({
      statusCode: 404,
      message: "No encontrado en AniList"
    });
  }

  const media = anilist.data.Media;

  // 🔥 2. GENERAR POSIBLES NOMBRES
  const names = [
    media.title?.romaji,
    media.title?.english,
    media.title?.native,
    ...(media.synonyms || [])
  ].filter(Boolean);

  const normalize = (t: string) =>
    t
      .toLowerCase()
      .replace(/[:]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^\w-]/g, "");

  const candidates = Array.from(
    new Set(names.map(normalize))
  );

  // 🔥 3. INTENTAR EN SCRAPER
  let found: any = null;
  let usedSlug = null;

  for (const name of candidates) {
    try {
      const search = await searchAnime(name, 1);
      if (search?.media?.length) {
        const first = search.media[0];
        const info = await getAnimeInfo(first.slug).catch(() => null);

        if (info) {
          found = info;
          usedSlug = first.slug;
          break;
        }
      }
    } catch {}
  }

  if (!found) {
    throw createError({
      statusCode: 404,
      message: "No se pudo resolver el anime"
    });
  }

  return {
    success: true,
    data: {
      anilistId: id,
      resolvedSlug: usedSlug,
      title: found.title,
      cover: found.cover,
      episodes: found.episodes || [],
      totalEpisodes: found.episodes?.length || 0
    }
  };
});
