import { getEpisode } from "animeflv-scraper";

export default defineEventHandler(async (event) => {

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

  const { slug } = getRouterParams(event) as { slug: string };

  // 🔥 VALIDACIÓN
  if (!slug) {
    throw createError({
      statusCode: 400,
      message: "Slug requerido",
    });
  }

  // 🔥 USAMOS FUNCIÓN CORRECTA
  const episode = await getEpisode(slug).catch(() => null);

  if (!episode) {
    throw createError({
      statusCode: 404,
      message: "No se ha encontrado el episodio",
    });
  }

  return {
    success: true,
    data: episode
  };
});
