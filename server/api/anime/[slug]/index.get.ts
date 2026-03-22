import { getAnimeInfo } from "animeflv-scraper";

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

  const { slug } = getRouterParams(event) as { slug: string };

  const info = await getAnimeInfo(slug).catch(() => null);
  
  if (!info) {
    throw createError({
      statusCode: 404,
      message: "No se ha encontrado el anime",
      data: { success: false }
    });
  }

  return {
    success: true,
    data: info
  };

}, {
  swr: false,
  maxAge: 86400,
  name: "info",
  group: "anime",
  getKey: event => getRouterParams(event).slug
});
