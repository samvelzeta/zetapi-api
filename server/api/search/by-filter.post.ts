import { searchAnimesByFilter, GenreEnum, StatusEnum, TypeEnum, OrderEnum } from "animeflv-scraper";

const genres = Object.values(GenreEnum);
const statuses = Object.values(StatusEnum);
const types = Object.values(TypeEnum);
const orders = Object.values(OrderEnum);

export default defineEventHandler(async (event) => {
  // --- LIBERACIÓN DE CORS (AUTORIDAD TOTAL) ---
  setResponseHeaders(event, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
  });

  // Respuesta rápida para el navegador (Pre-consulta)
  if (getMethod(event) === 'OPTIONS') {
    event.node.res.statusCode = 204;
    return 'ok';
  }

  const body = await readBody(event);
  const { order, page } = getQuery(event) as { order: string, page: number };

  // Validaciones de seguridad
  const invalid_order = !orders?.includes(order);
  if (order && invalid_order) {
    throw createError({
      statusCode: 400,
      message: `Orden no válido: ${order}`,
      data: { success: false, error: `Orden no válido: ${order}`, hint: orders }
    });
  }

  const invalid_types = body?.types?.filter((t: string) => !types?.includes(t));
  if (invalid_types?.length) {
    throw createError({
      statusCode: 400,
      message: `Tipos no válidos: ${invalid_types?.join(", ")}`,
      data: { success: false, error: `Tipos no válidos: ${invalid_types?.join(", ")}`, hint: types }
    });
  }

  const invalid_genres = body?.genres?.filter((g: string) => !genres?.includes(g));
  if (invalid_genres?.length) {
    throw createError({
      statusCode: 400,
      message: `Géneros no válidos: ${invalid_genres?.join(", ")}`,
      data: { success: false, error: `Géneros no válidos: ${invalid_genres?.join(", ")}`, hint: genres }
    });
  }

  const invalid_statuses = body?.statuses?.filter((s: number) => !statuses?.includes(s));
  if (invalid_statuses?.length) {
    throw createError({
      statusCode: 400,
      message: `Estados no válidos: ${invalid_statuses?.join(", ")}`,
      data: { success: false, error: `Estados no válidos: ${invalid_statuses?.join(", ")}`, hint: StatusEnum }
    });
  }

  if (body?.genres?.length > 4) {
    throw createError({
      statusCode: 400,
      message: "Solo se permite un máximo de 4 géneros",
      data: { success: false, error: "Solo se permite un máximo de 4 géneros" }
    });
  }

  const orderKeyMap: Record<string, string> = {
    default: "Por Defecto",
    updated: "Recientemente Actualizados",
    added: "Recientemente Agregados",
    title: "Nombre A-Z",
    rating: "Calificación"
  };

  const mappedOrder = orderKeyMap[order];

  try {
    const search = await searchAnimesByFilter({ ...body, order: mappedOrder, page });
    
    if (!search || !search?.media?.length) {
      throw createError({
        statusCode: 404,
        message: "No se han encontrado resultados",
        data: { success: false, error: "No se han encontrado resultados" }
      });
    }

    return {
      success: true,
      data: search
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: "Error interno al filtrar animes",
      data: { success: false, error: error.message }
    });
  }
});

defineRouteMeta({
  openAPI: {
    tags: ["Search"],
    summary: "Busca usando filtros",
    description: "Ejecuta una búsqueda de animes utilizando filtros como tipo, géneros y estados.",
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              types: {
                type: "array",
                items: { type: "string", enum: ["tv", "movie", "special", "ova"] }
              },
              genres: {
                type: "array",
                items: { type: "string" },
                maxItems: 4
              },
              statuses: {
                type: "array",
                items: { type: "number", enum: [1, 2, 3] }
              }
            }
          }
        }
      }
    },
    parameters: [
      { name: "order", in: "query", schema: { type: "string", enum: ["default", "updated", "added", "title", "rating"] } },
      { name: "page", in: "query", schema: { type: "number" } }
    ],
    responses: {
      200: { description: "Resultados de la búsqueda filtrada." },
      400: { description: "Parámetros de filtro inválidos." },
      404: { description: "Sin resultados." }
    }
  }
});
