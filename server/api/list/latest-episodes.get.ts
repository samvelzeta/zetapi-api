import { getLatest } from "animeflv-scraper";
import { getLatestFallbackEpisodes } from "../../utils/latestFallback";

export default defineEventHandler(async (event) => {
  // ðŸ”¥ CORS FIX
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (event.method === "OPTIONS") return "";

  const latest = await getLatest().catch(() => []);

  // Fallback si animeflv-scraper devuelve vacío
  if (!latest || latest.length === 0) {
    const fallback = await getLatestFallbackEpisodes();

    if (!fallback.length) {
      throw createError({ statusCode: 404, message: "No hay episodios recientes" });
    }

    return {
      success: true,
      source: "fallback-latino",
      total: fallback.length,
      data: fallback
    };
  }

  return {
    success: true,
    source: "animeflv-scraper",
    total: latest.length,
    data: latest
  };
});
// fix
