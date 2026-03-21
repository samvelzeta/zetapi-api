import { getAnimeInfo } from "animeflv-scraper";

export default defineCachedEventHandler(async (event) => {
  // 1. CONFIGURACIÓN DE CORS
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

  // 2. OBTENCIÓN DE PARÁMETROS
  const { slug } = getRouterParams(event) as { slug: string };

  try {
    // 3. CONSULTA AL SCRAPER ORIGINAL (AnimeFLV)
    const info = await getAnimeInfo(slug);

    if (!info) {
      throw createError({
        statusCode: 404,
        message: "Anime no encontrado en AnimeFLV",
      });
    }

    return {
      success: true,
      data: info
    };

  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Error al obtener la información del anime",
    });
  }
}, {
  // Configuración de Caché (1 día para no saturar la fuente)
  swr: false,
  maxAge: 86400,
  name: "info",
  group: "anime",
  getKey: (event) => {
    const { slug } = getRouterParams(event);
    return slug; // Simplificado: ya no necesita diferenciar por idioma
  }
});

// --- DOCUMENTACIÓN OPENAPI ---
defineRouteMeta({
  openAPI: {
    tags: ["Anime"],
    summary: "Detalles del Anime y Lista de Episodios",
    description: "Obtiene la información completa (sinopsis, géneros, episodios) directamente de AnimeFLV.",
    parameters: [
      {
        name: "slug",
        in: "path",
        required: true,
        description: "Slug único del anime (ej: black-clover)",
        schema: { type: "string" }
      }
    ],
    responses: {
      200: { 
        description: "Información cargada correctamente.",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: { type: "object" }
              }
            }
          }
        }
      },
      404: { description: "El anime no existe o el slug es incorrecto." }
    }
  }
});
