import { searchAnime } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  // 1. CONFIGURACIÓN DE CORS (Autoridad Total para Base44/Lovable)
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

  // 2. EXTRACCIÓN DE PARÁMETROS
  const { query, page } = getQuery(event) as { query: string, page: string };
  
  if (!query) {
    throw createError({
      statusCode: 400,
      message: "Falta el parámetro de búsqueda (query)",
    });
  }

  try {
    // 3. MOTOR ORIGINAL (AnimeFLV Exclusivamente)
    // Eliminamos la detección de 'lang === latino' y el scraper manual
    const results = await searchAnime(query, Number(page) || 1);

    return { 
      success: true, 
      data: results || [] 
    };

  } catch (error: any) {
    // 4. CAPTURA DE ERROR GLOBAL
    throw createError({ 
      statusCode: 500, 
      message: "Error interno en el servidor de búsqueda",
      data: { success: false, info: error.message }
    });
  }
});
