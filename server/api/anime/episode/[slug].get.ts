import { getAnimeInfo } from "animeflv-scraper";

export default defineCachedEventHandler(async (event) => {
  // 🔥 CORS FIX
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (event.method === "OPTIONS") return "";

  // 🔥 PREFLIGHT (CORRECTO)
  if (event.method === "OPTIONS") {
    setResponseStatus(event, 200);
    return "";
  }

  // 🔐 API KEY
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
