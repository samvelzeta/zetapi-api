import { searchAnime } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  // 🌐 CORS
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key");

  // 🔥 PREFLIGHT
  if (event.method === "OPTIONS") {
    return {
      status: 200
    };
  }

  // 🔐 API KEY
  const apiKey = getHeader(event, "x-api-key");

  const envKey =
    process.env.API_KEY ||
    event.context.cloudflare?.env?.API_KEY;

  if (!envKey || apiKey !== envKey) {
    throw createError({ statusCode: 401 });
  }

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
