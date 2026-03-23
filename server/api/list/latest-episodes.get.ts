import { getLatest } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
 // 🔥 CORS FIX
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (event.method === "OPTIONS") return "";
  const latest = await getLatest();

  if (!latest) {
    throw createError({ statusCode: 404 });
  }

  return {
    success: true,
    data: latest
  };
});
//fix
