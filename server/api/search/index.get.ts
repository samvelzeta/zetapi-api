import { searchAnime } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  // 🔐 API KEY
  const apiKey = getHeader(event, "x-api-key");
  if (apiKey !== process.env.API_KEY) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  // 🌐 CORS
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "*");

  if (event.method === "OPTIONS") return;

  const { query, page } = getQuery(event) as { query: string, page: string };

  const search = await searchAnime(query, Number(page) || 1);

  if (!search || !search?.media?.length) {
    throw createError({
      statusCode: 404,
      message: "No se han encontrado resultados"
    });
  }

  // 🔥 NORMALIZAR
  const normalized = search.media.map((anime: any) => ({
    title: anime.title,
    cover: anime.cover,
    synopsis: anime.synopsis,
    rating: anime.rating,
    slug: anime.slug,
    type: anime.type,
    url: anime.url
  }));

  return {
    success: true,
    total: normalized.length,
    data: normalized
  };
});
