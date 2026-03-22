import { getEpisode } from "animeflv-scraper";

export default defineCachedEventHandler(async (event) => {

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

  const { slug, number } = getRouterParams(event) as { slug: string, number: string };

  // 🔥 VALIDACIONES (IMPORTANTE)
  if (!slug || !number) {
    throw createError({
      statusCode: 400,
      message: "Slug y número requeridos",
    });
  }

  const epNumber = Number(number);

  if (isNaN(epNumber)) {
    throw createError({
      statusCode: 400,
      message: "Número de episodio inválido",
    });
  }

  // 🔥 CONTROL DE ERROR
  const episode = await getEpisode(slug, epNumber).catch(() => null);
  
  if (!episode) {
    throw createError({
      statusCode: 404,
      message: "No se ha encontrado el episodio",
      data: { success: false }
    });
  }

  return {
    success: true,
    data: episode
  };

}, {
  swr: false,
  maxAge: 86400,
  name: "episode",
  group: "anime",
  getKey: (event) => {
    const { slug, number } = getRouterParams(event) as any;
    return `${slug}-${number}`;
  }
});
