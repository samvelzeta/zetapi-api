import { searchAnimesByURL } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  const apiKey = getHeader(event, "x-api-key");

  const envKey =
    process.env.API_KEY ||
    event.context.cloudflare?.env?.API_KEY;

  if (!envKey || apiKey !== envKey) {
    throw createError({ statusCode: 401 });
  }

  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "*");

  if (event.method === "OPTIONS") return;

  const { url } = getQuery(event) as { url: string };

  const search = await searchAnimesByURL(url);

  if (!search || !search?.media?.length) {
    throw createError({
      statusCode: 404,
      message: "No se encontraron resultados"
    });
  }

  return {
    success: true,
    data: search
  };
});
