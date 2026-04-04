import { searchAnimesByURL } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  // ðÅ¸â€ ¥ CORS FIX
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (event.method === "OPTIONS") return "";

  // ðÅ¸â€ ¥ PREFLIGHT
  if (event.method === "OPTIONS") {
    return {
      status: 200
    };
  }

  // ðÅ¸â€   API KEY
  const apiKey = getHeader(event, "x-api-key");

  const envKey =
    process.env.API_KEY ||
    event.context.cloudflare?.env?.API_KEY;

  if (!envKey || apiKey !== envKey) {
    throw createError({ statusCode: 401 });
  }

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
//fix
