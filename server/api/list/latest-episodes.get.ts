import { getLatest } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  // 1. CONFIGURACIÓN DE CABECERAS (Autoridad Total para Base44)
  setResponseHeaders(event, {
    "Access-Control-Allow-Origin": "*", 
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400" 
  });

  // 2. MANEJO DE PRE-CONSULTA
  if (getMethod(event) === 'OPTIONS') {
    event.node.res.statusCode = 204;
    return 'ok';
  }

  // 3. OBTENCIÓN DE PARÁMETROS
  const { lang } = getQuery(event) as { lang?: string };

  // 4. LÓGICA DE OBTENCIÓN DE DATOS HÍBRIDA
  try {
    let results;

    if (lang === 'latino') {
      // Scraper para AnimeLatinoHD (Contenido Doblado)
      const html = await $fetch<string>("https://www.animelatinohd.com", {
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      const regex = /<div class="capitulo-item">[\s\S]*?href="\/ver\/(.*?)\/(.*?)"[\s\S]*?src="(.*?)"[\s\S]*?<h3.*?>(.*?)<\/h3>/g;
      const episodes = [];
      let match;

      while ((match = regex.exec(html)) !== null) {
        episodes.push({
          title: match[4].trim(),
          number: Number(match[2]),
          cover: match[3],
          slug: match[1],
          url: `/anime/${match[1]}/episode/${match[2]}?lang=latino`
        });
      }
      results = episodes;
    } else {
      // Scraper original de AnimeFLV (Contenido Subtitulado)
      results = await getLatest();
    }

    if (!results || results.length === 0) {
      throw createError({
        statusCode: 404,
        message: "No se encontraron episodios",
      });
    }

    return {
      success: true,
      data: results
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Error en el servidor de Anime",
    });
  }
});

// --- NO BORRES EL BLOQUE DE ABAJO (Documentación OpenAPI) ---
defineRouteMeta({
  openAPI: {
    tags: ["List"],
    summary: "Lista de últimos episodios lanzados",
    description: "Obtiene una lista de últimos episodios lanzados (Soporta ?lang=latino).",
    parameters: [
      {
        name: "lang",
        in: "query",
        description: "Idioma de los episodios (latino o sub)",
        required: false,
        schema: { type: "string" }
      }
    ],
    responses: {
      200: {
        description: "Retorna un arreglo de objetos de episodios.",
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
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
});
