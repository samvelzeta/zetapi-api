import { getLatest } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  // 1. CONFIGURACIÓN DE CABECERAS (Autoridad Total para Base44)
  setResponseHeaders(event, {
    // Permite que cualquier dominio (incluyendo Base44) acceda a los datos
    "Access-Control-Allow-Origin": "*", 
    // Métodos permitidos para la API
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    // Permitimos todas las cabeceras para evitar bloqueos por 'Accept' o 'Content-Type'
    "Access-Control-Allow-Headers": "*",
    // Cache de permisos por 24 horas para mejorar la velocidad
    "Access-Control-Max-Age": "86400" 
  });

  // 2. MANEJO DE PRE-CONSULTA (IMPORTANTE)
  // El navegador envía un OPTIONS antes del GET. Si respondemos 204, el bloqueo desaparece.
  if (getMethod(event) === 'OPTIONS') {
    event.node.res.statusCode = 204;
    return 'ok';
  }

  // 3. LÓGICA DE OBTENCIÓN DE DATOS
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

// --- NO BORRES EL BLOQUE DE ABAJO (Documentación OpenAPI) ---
defineRouteMeta({
  openAPI: {
    tags: ["List"],
    summary: "Lista de últimos episodios lanzados",
    description: "Obtiene una lista de últimos episodios lanzados.",
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
