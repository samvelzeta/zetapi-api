import { getLatest } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  setHeader(event, "Access-Control-Allow-Origin", "*");

  const latest = await getLatest();

  if (!latest) {
    throw createError({ statusCode: 404 });
  }

  return {
    success: true,
    data: latest
  };
});
