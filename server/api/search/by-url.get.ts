import { searchAnimesByURL } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  // 1. CONFIGURACIÓN DE CABECERAS (CORS Total)
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

  const { url } = getQuery(event) as { url: string };

  if (!url) {
    throw createError({
      statusCode: 400,
      message: "Se requiere una URL para procesar la búsqueda",
    });
  }

  try {
    // 2. DETECCIÓN HÍBRIDA DE FUENTE
    if (url.includes("animelatinohd.com")) {
      // Lógica para URLs de AnimeLatinoHD
      const slug = url.split("/anime/")[1]?.split("/")[0];
      
      if (!slug) {
        throw createError({ statusCode: 400, message: "URL de LatinoHD no válida" });
      }

      // Devolvemos un formato compatible con lo que espera tu frontend
      return {
        success: true,
        data: {
          currentPage: 1,
          hasNextPage: false,
          media: [{
            title: slug.replace(/-/g, " "),
            slug: slug,
            cover: "", // La info completa se cargará al entrar al perfil
            type: "Anime",
            url: `/anime/${slug}?lang=latino`
          }]
        }
      };
    }

    // 3. LÓGICA ORIGINAL (AnimeFLV)
    const search = await searchAnimesByURL(url);
    
    if (!search || !search?.media?.length) {
      throw createError({
        statusCode: 404,
        message: "No se han encontrado resultados",
      });
    }

    return {
      success: true,
      data: search
    };

  } catch (error: any) {
    // 4. CAPTURA DE ERRORES PARA EVITAR CRASH
    throw createError({
      statusCode: error.statusCode || 500,
      message: "Error al procesar la URL",
      data: { success: false, error: error.message }
    });
  }
});

// --- DOCUMENTACIÓN OPENAPI ---
defineRouteMeta({
  openAPI: {
    tags: ["Search"],
    summary: "Busca con URL de búsqueda",
    description: "Soporta URLs de AnimeFLV y AnimeLatinoHD.",
    parameters: [
      {
        name: "url",
        in: "query",
        required: true,
        schema: { type: "string", format: "uri" }
      }
    ]
  }
});
