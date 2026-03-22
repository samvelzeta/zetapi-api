import { searchAnimesByFilter, GenreEnum, StatusEnum, TypeEnum, OrderEnum } from "animeflv-scraper";

const genres = Object.values(GenreEnum);
const statuses = Object.values(StatusEnum);
const types = Object.values(TypeEnum);
const orders = Object.values(OrderEnum);

export default defineEventHandler(async (event) => {
  // 🌐 CORS
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "POST,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key");

  // 🔥 PREFLIGHT
  if (event.method === "OPTIONS") {
    return {
      status: 200
    };
  }

  // 🔐 API KEY
  const apiKey = getHeader(event, "x-api-key");

  const envKey =
    process.env.API_KEY ||
    event.context.cloudflare?.env?.API_KEY;

  if (!envKey || apiKey !== envKey) {
    throw createError({ statusCode: 401 });
  }

  const body = await readBody(event);
  const { order, page } = getQuery(event) as { order: string, page: number };

  const mappedOrder = {
    default: "Por Defecto",
    updated: "Recientemente Actualizados",
    added: "Recientemente Agregados",
    title: "Nombre A-Z",
    rating: "Calificación"
  }[order];

  const search = await searchAnimesByFilter({
    ...body,
    order: mappedOrder,
    page
  });

  if (!search || !search?.media?.length) {
    throw createError({
      statusCode: 404,
      message: "No se encontraron resultados"
    });
  }

  return {
    success: true,
    data: search
  };
});
