import { getOnAir } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  // 🔐 API KEY
  const apiKey = getHeader(event, "x-api-key");
  if (apiKey !== process.env.API_KEY) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
      data: { success: false, error: "Invalid API KEY" }
    });
  }

  // 🌐 CORS
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "*");

  if (event.method === "OPTIONS") return;

  const onair = await getOnAir();

  if (!onair) {
    throw createError({
      statusCode: 404,
      message: "No se han encontrado resultados",
      data: { success: false, error: "No se han encontrado resultados" }
    });
  }

  // 🔥 NORMALIZAR (preparado multi-fuente)
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
