import { searchAnime } from "animeflv-scraper";

export default defineEventHandler(async (event) => {

  const { query, page } = getQuery(event) as { query: string, page: string };

  if (!query) {
    throw createError({ statusCode: 400, message: "Query requerida" });
  }

  const results = await searchAnime(query, Number(page) || 1);

  return {
    success: true,
    data: results
  };
});
