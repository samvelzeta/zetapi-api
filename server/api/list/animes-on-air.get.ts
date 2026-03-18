import { getOnAir } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  // 1. CONFIGURACIÓN DE AUTORIDAD TOTAL (CORS)
  setResponseHeaders(event, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*", // Esto permite cualquier cabecera
    "Access-Control-Max-Age": "86400",
  });

  // 2. MANEJO DE PRE-CONSULTA (IMPORTANTE PARA EL NAVEGADOR)
  if (getMethod(event) === 'OPTIONS') {
    event.node.res.statusCode = 204;
    return 'ok';
  }

  // 3. LÓGICA DE OBTENCIÓN DE DATOS
  try {
    const onair = await getOnAir();
    if (!onair) {
      throw createError({
        statusCode: 404,
        message: "No se han encontrado resultados",
        data: { success: false, error: "No se han encontrado resultados" }
      });
    }
    return {
      success: true,
      data: onair
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: "Error interno del servidor",
      data: { success: false, error: error.message }
    });
  }
});

// DOCUMENTACIÓN OPENAPI (SE MANTIENE IGUAL PARA TU PROYECTO DEL SENA)
defineRouteMeta({
  openAPI: {
    tags: ["List"],
    summary: "Lista de animes en emisión",
    description: "Obtiene una lista de animes en emisión.",
    responses: {
      200: {
        description: "Retorna un arreglo de objetos...",
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
                      type: { type: "string" },
                      slug: { type: "string" },
                      url: { type: "string" }
                    },
                    required: ["title", "type", "slug", "url"]
                  }
                }
              },
              required: ["success", "data"]
            }
          }
        }
      },
      404: {
        description: "No se han encontrado resultados.",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "boolean", example: true },
                url: { type: "string" },
                statusCode: { type: "number", example: 404 },
                message: { type: "string" },
                data: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: false },
                    error: { type: "string" }
                  },
                  required: ["success", "error"]
                }
              },
              required: ["error", "url", "statusCode", "message", "data"]
            }
          }
        }
      }
    }
  }
});
