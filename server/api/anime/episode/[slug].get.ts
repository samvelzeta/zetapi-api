import { getAnimeInfo } from "animeflv-scraper";

export default defineCachedEventHandler(async (event) => {
  // ðÅ¸â€ ¥ CORS FIX
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (event.method === "OPTIONS") return "";

  // ðÅ¸â€ ¥ PREFLIGHT (CORRECTO)
  if (event.method === "OPTIONS") {
    setResponseStatus(event, 200);
    return "";
  }

  // ðÅ¸â€   API KEY
  const apiKey = getHeader(event, "x-api-key");
  const envKey =
    process.env.API_KEY ||
    event.context.cloudflare?.env?.API_KEY;

  if (!envKey || apiKey !== envKey) {
    throw createError({ statusCode: 401 });
  }

  const { slug } = getRouterParams(event);

  const data = await getAnimeInfo(slug).catch(() => null);

  if (!data) {
    throw createError({ statusCode: 404 });
  }

  return {
    success: true,
    data
  };
});
//nuevo
