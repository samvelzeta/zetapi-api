import { searchAnime } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  // --- LIBERACIÓN DE CORS (AUTORIDAD TOTAL) ---
  setResponseHeaders(event, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
  });

  if (getMethod(event) === 'OPTIONS') {
    event.node.res.statusCode = 204;
    return 'ok';
  }

  const { query, page } = getQuery(event) as { query: string, page: string };
  
  try {
    const search = await searchAnime(query, Number(page) || 1);
    return { success: true, data: search };
  } catch (error) {
    throw createError({ 
      statusCode: 500, 
      message: "Error en la búsqueda",
      data: { success: false, error: error.message }
    });
  }
});
