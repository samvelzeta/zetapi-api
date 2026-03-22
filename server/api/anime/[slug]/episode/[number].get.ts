import { getEpisode } from "animeflv-scraper";

export default defineCachedEventHandler(async (event) => {
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (event.method === "OPTIONS") return "";

  const apiKey = getHeader(event, "x-api-key");
  const envKey =
    process.env.API_KEY ||
    event.context.cloudflare?.env?.API_KEY;

  if (!envKey || apiKey !== envKey) {
    throw createError({ statusCode: 401 });
  }

  const { slug, number } = getRouterParams(event);

  const episode = await getEpisode(slug, Number(number)).catch(() => null);

  if (!episode) throw createError({ statusCode: 404 });

  return {
    success: true,
    data: episode
  };
});
