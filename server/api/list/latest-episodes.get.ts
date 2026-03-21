import { getLatest } from "animeflv-scraper";

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

  // 2. LÓGICA DE OBTENCIÓN DE DATOS
  try {
    const latest = await getLatest();
    
    if (!latest || latest.length === 0) {
      throw createError({
        statusCode: 404,
        message: "No se encontraron episodios recientes",
      });
    }

    return {
      success: true,
      data: latest
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Error al obtener los últimos episodios",
    });
  }
}, {
  // Configuración de Caché (10 minutos)
  // Como son episodios nuevos, 10 min es ideal para estar al día
  swr: true,
  maxAge: 600, 
  name: "latest",
  group: "anime"
});

// --- DOCUMENTACIÓN OPENAPI ---
defineRouteMeta({
  openAPI: {
    tags: ["List"],
    summary: "Lista de últimos episodios lanzados",
    description: "Obtiene una lista de los episodios más recientes agregados a la plataforma.",
    responses: {
      200: {
        description: "Lista obtenida con éxito",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                data: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      number: { type: "number" },
                      cover: { type: "string" },
                      slug: { type: "string" },
                      url: { type: "string" }
                    },
                    required: ["title", "number", "cover", "slug", "url"]
                  }
                }
              },
              required: ["success", "data"]
            }
          }
        }
      },
      404: { description: "No se han encontrado resultados." }
    }
  }
});
