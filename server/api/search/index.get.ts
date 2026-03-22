import { searchAnime } from "animeflv-scraper";

export default defineEventHandler(async (event) => {

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

  const { query, page, lang } = getQuery(event) as { query: string, page: string, lang?: string };
  
  try {
    let results;

    switch (lang) {
      case 'latino':
        results = await searchAnimeLatino(query, page); 
        break;
      
      case 'jkanime':
        results = await searchInJK(query, page);
        break;

      default:
        results = await searchAnime(query, Number(page) || 1);
        break;
    }
    
    if (!results || (results.media && results.media.length === 0)) {
      throw createError({
        statusCode: 404,
        message: `No se encontraron resultados para "${query}"`,
        data: { success: false }
      });
    }

    return {
      success: true,
      data: results
    };

  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Error en el servidor de búsqueda",
    });
  }
});

// FUNCIONES
async function searchAnimeLatino(query: string, page: string) {
  throw createError({ statusCode: 501, message: "Motor Latino en configuración" });
}

async function searchInJK(query: string, page: string) {
  throw createError({ statusCode: 501, message: "Motor JKAnime en configuración" });
}
