import { getLatest } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  // 🔐 API KEY
  const apiKey = getHeader(event, "x-api-key");
  if (apiKey !== process.env.API_KEY) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
      data: { success: false, error: "Invalid API KEY" }
    });
  }

  // 🌐 CORS
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "*");

  if (event.method === "OPTIONS") return;

  const latest = await getLatest();

  if (!latest) {import { getLatest } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  const apiKey = getHeader(event, "x-api-key");

  const envKey =
    process.env.API_KEY ||
    event.context.cloudflare?.env?.API_KEY;

  if (!envKey || apiKey !== envKey) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized",
      data: { success: false, error: "Invalid API KEY" }
    });
  }

  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "*");

  if (event.method === "OPTIONS") return;

  const latest = await getLatest();

  if (!latest) {
    throw createError({
      statusCode: 404,
      message: "No se han encontrado resultados",
      data: { success: false, error: "No se han encontrado resultados" }
    });
  }

  const normalized = latest.map((ep: any) => ({
    title: ep.title,
    number: ep.number,
    cover: ep.cover,
    slug: ep.slug,
    url: ep.url
  }));

  return {
    success: true,
    total: normalized.length,
    data: normalized
  };
});

defineRouteMeta({
  openAPI: {
    tags: ["List"],
    summary: "Últimos episodios (optimizado)",
    description: "Lista de episodios lista para frontend",
    responses: {
      200: {
        description: "Lista de episodios recientes"
      }
    }
  }
});
    throw createError({
      statusCode: 404,
      message: "No se han encontrado resultados",
      data: { success: false, error: "No se han encontrado resultados" }
    });
  }

  // 🔥 NORMALIZAR PARA FRONTEND
  const normalized = latest.map((ep: any) => ({
    title: ep.title,
    number: ep.number,
    cover: ep.cover,
    slug: ep.slug,
    url: ep.url
  }));

  return {
    success: true,
    total: normalized.length,
    data: normalized
  };
});

defineRouteMeta({
  openAPI: {
    tags: ["List"],
    summary: "Últimos episodios (optimizado)",
    description: "Lista de episodios lista para frontend",
    responses: {
      200: {
        description: "Lista de episodios recientes"
      }
    }
  }
});
