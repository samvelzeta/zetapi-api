import { searchAnime } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
 // 🔥 CORS FIX
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (event.method === "OPTIONS") return "";

  // 🔐 API KEY
  const apiKey = getHeader(event, "x-api-key");
  const envKey = process.env.API_KEY || event.context.cloudflare?.env?.API_KEY;

  if (!envKey || apiKey !== envKey) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const { query, page } = getQuery(event) as { query: string, page: string };

  if (!query) {
    throw createError({ statusCode: 400, message: "Query requerida" });
  }

  const search = await searchAnime(query, Number(page) || 1);

  if (!search?.media?.length) {
    throw createError({ statusCode: 404, message: "Sin resultados" });
  }

  return {
    success: true,
    total: search.media.length,
    data: search.media
  };
});
