import { searchAnime } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  const apiKey = getHeader(event, "x-api-key");
  if (apiKey !== process.env.API_KEY) {
    throw createError({ statusCode: 401 });
  }

  setHeader(event, "Access-Control-Allow-Origin", "*");

  const { query, page } = getQuery(event) as { query: string, page: string };

  const base = await searchAnime(query, Number(page) || 1);

  if (!base || !base.media?.length) {
    throw createError({ statusCode: 404 });
  }

  const data = base.media.map((a: any) => ({
    title: a.title,
    cover: a.cover,
    slug: a.slug,
    rating: a.rating,
    type: a.type
  }));

  return {
    success: true,
    total: data.length,
    data
  };
});
