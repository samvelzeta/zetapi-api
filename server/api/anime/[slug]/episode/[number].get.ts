import { getEpisode } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (event.method === "OPTIONS") return "";

  const { slug, number } = getRouterParams(event) as { slug: string, number: string };

  const episode = await getEpisode(slug, Number(number)).catch(() => null);

  if (!episode) {
    throw createError({ statusCode: 404, message: "Episodio no encontrado" });
  }

  return {
    success: true,
    data: episode
  };
});
