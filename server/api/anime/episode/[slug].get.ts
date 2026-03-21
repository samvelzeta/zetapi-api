import { getAnimeInfo } from "animeflv-scraper";

export default defineCachedEventHandler(async (event) => {
  // 1. CONFIGURACIÓN DE CORS (Autoridad Total)
  setResponseHeaders(event, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
  });

  // Respuesta rápida para pre-consulta (OPTIONS)
  if (getMethod(event) === 'OPTIONS') {
    event.node.res.statusCode = 204;
    return 'ok';
  }

  // 2. EXTRACCIÓN DEL PARÁMETRO SLUG
  const { slug } = getRouterParams(event) as { slug: string };
  
  try {
    // 3. CONSULTA AL SCRAPER (Info General)
    const info = await getAnimeInfo(slug);

    if (!info) {
      throw createError({
        statusCode: 404,
        message: "No se ha encontrado la información del anime solicitado",
      });
    }

    return {
      success: true,
      data: info
    };

  } catch (error: any) {
    // 4. CAPTURA DE ERRORES
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Error al obtener la información del anime",
    });
  }
}, {
  // Configuración de Caché (1 día)
  swr: false,
  maxAge: 86400,
  name: "info",
  group: "anime",
  getKey: (event) => {
    const { slug } = getRouterParams(event);
    return `${slug}`;
  }
});

// --- DOCUMENTACIÓN OPENAPI ---
defineRouteMeta({
  openAPI: {
    tags: ["Anime"],
    summary: "Información detallada del Anime",
    description: "Obtiene sinopsis, lista de episodios, géneros y más usando el slug.",
    parameters: [
      {
        name: "slug",
        in: "path",
        required: true,
        description: "Slug del anime (ej: black-clover-tv)",
        schema: { type: "string" }
      }
    ],
    responses: {
      200: { 
        description: "Información obtenida con éxito",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                data: { type: "object" }
              }
            }
          }
        }
      },
      404: { description: "Anime no encontrado" }
    }
  }
});
