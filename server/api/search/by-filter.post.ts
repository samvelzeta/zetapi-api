import { searchAnime } from "animeflv-scraper";



export default defineEventHandler(async (event) => {

  // 1. CONFIGURACIÓN DE AUTORIDAD TOTAL (CORS)

  setResponseHeaders(event, {

    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",

    "Access-Control-Allow-Headers": "*",

    "Access-Control-Max-Age": "86400",

  });



  // 2. MANEJO DE PRE-CONSULTA (OPTIONS)

  if (getMethod(event) === 'OPTIONS') {

    event.node.res.statusCode = 204;

    return 'ok';

  }



  // 3. LÓGICA DE BÚSQUEDA

  const { query, page } = getQuery(event) as { query: string, page: string };

  

  try {

    const search = await searchAnime(query, Number(page) || 1);

    

    if (!search || !search?.media?.length) {

      throw createError({

        statusCode: 404,

        message: "No se han encontrado resultados en la búsqueda",

        data: { success: false, error: "No se han encontrado resultados en la búsqueda" }

      });

    }



    return {

      success: true,

      data: search

    };

  } catch (error) {

    throw createError({

      statusCode: error.statusCode || 500,

      message: error.message || "Error en el servidor de búsqueda",

    });

  }

});



// TU DOCUMENTACIÓN OPENAPI (SE MANTIENE IGUAL)

defineRouteMeta({

  openAPI: {

    tags: ["Search"],

    summary: "Busca un anime con texto",

    description: "Ejecuta una búsqueda de animes utilizando una consulta de texto.",

    parameters: [

      {

        name: "query",

        in: "query",

        summary: "La consulta.",

        example: "isekai",

        required: true,

        schema: {

          type: "string"

        }

      },

      {

        name: "page",

        in: "query",

        summary: "El número de página.",

        example: 1,

        required: false,

        schema: {

          type: "number"

        }

      }

    ],

    responses: {

      200: {

        description: "Retorna un objeto con resultados de búsqueda...",

        content: {

          "application/json": {

            schema: {

              type: "object",

              properties: {

                success: { type: "boolean", example: true },

                data: {

                  type: "object",

                  properties: {

                    currentPage: { type: "number", example: 1 },

                    hasNextPage: { type: "boolean" },

                    previousPage: { type: "string", nullable: true },

                    nextPage: { type: "string", nullable: true },

                    foundPages: { type: "number", example: 10 },

                    media: {

                      type: "array",

                      items: {

                        type: "object",

                        properties: {

                          title: { type: "string" },

                          cover: { type: "string" },

                          synopsis: { type: "string" },

                          rating: { type: "string" },

                          slug: { type: "string" },

                          type: { type: "string" },

                          url: { type: "string" }

                        },

                        required: ["title", "cover", "synopsis", "rating", "slug", "type", "url"]

                      }

                    }

                  },

                  required: ["currentPage", "hasNextPage", "previousPage", "nextPage", "foundPages", "media"]

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
