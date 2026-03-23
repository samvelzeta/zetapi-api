import { getOnAir } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
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
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
      data: { success: false, error: "Invalid API KEY" }
    });
  }

  const onair = await getOnAir();

  if (!onair) {
    throw createError({
      statusCode: 404,
      message: "No se han encontrado resultados",
      data: { success: false, error: "No se han encontrado resultados" }
    });
  }

  const normalized = onair.map((anime: any) => ({
    title: anime.title,
    type: anime.type,
    slug: anime.slug,
    url: anime.url
  }));

  return {
    success: true,
    total: normalized.length,
    data: normalized
  };
});

defineRouteMeta({
  openAPI: {
    tags: ["List"],
    summary: "Lista de animes en emisión (optimizado)",
    description: "Obtiene lista preparada para frontend",
    responses: {
      200: {
        description: "Lista de animes en emisión"
      }
    }
  }
});
//fix
