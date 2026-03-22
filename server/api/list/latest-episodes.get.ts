import { getLatest } from "animeflv-scraper";

export default defineEventHandler(async (event) => {

  setResponseHeaders(event, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400"
  });

  if (getMethod(event) === 'OPTIONS') {
    event.node.res.statusCode = 204;
    return 'ok';
  }

  try {
    const latest = await getLatest();

    if (!latest) {
      throw createError({
        statusCode: 404,
        message: "No se encontraron episodios",
      });
    }

    return {
      success: true,
      data: latest
    };

  } catch (error) {
    throw createError({
      statusCode: 500,
      message: "Error en el servidor de Anime",
    });
  }
});
