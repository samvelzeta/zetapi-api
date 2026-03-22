import { searchAnimesByURL } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  const apiKey = getHeader(event, "x-api-key");
  if (apiKey !== process.env.API_KEY) {
    throw createError({ statusCode: 401 });
  }

  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "*");

  if (event.method === "OPTIONS") return;

  const { url } = getQuery(event) as { url: string };

  const base = await searchAnimesByURL(url);

  if (!base || !base?.media?.length) {
    throw createError({ statusCode: 404 });
  }

  return {
    success: true,
    data: base
  };
});
