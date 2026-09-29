import { searchAnime } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(
    event,
    "Access-Control-Allow-Headers",
    "Content-Type, x-api-key, x-access-token, apikey, token, authorization",
  );

  if (event.method === "OPTIONS") return "";

  // Accept the same server-side secret naming used by the ZetaNimes proxy.
  // The browser never receives this value.
  const env = (event.context as any).cloudflare?.env;
  const envKey =
    env?.API_KEY ||
    env?.ZET_API_KEY ||
    process.env.API_KEY ||
    process.env.ZET_API_KEY;

  const providedKey =
    getHeader(event, "x-api-key") ||
    getHeader(event, "x-access-token") ||
    getHeader(event, "apikey") ||
    getHeader(event, "token") ||
    getHeader(event, "authorization")?.replace(/^Bearer\s+/i, "");

  if (!envKey || !providedKey || providedKey !== envKey) {
    throw createError({ statusCode: 403, statusMessage: "Access Denied", message: "Access Denied" });
  }

  const { query, page } = getQuery(event) as { query: string, page: string };

  if (!query) {
    throw createError({ statusCode: 400, message: "Query requerida" });
  }

  const search = await searchAnime(query, Number(page) || 1);

  if (!search?.media?.length) {
    throw createError({ statusCode: 404, message: "Sin resultados" });
  }

  return {
    success: true,
    total: search.media.length,
    data: search.media
  };
});
