import { getAnimeInfo, searchAnime } from "animeflv-scraper";

export default defineEventHandler(async (event) => {

  // 🔐 CORS COMPLETO
  setResponseHeaders(event, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
  });

  // 🔥 MANEJO OPTIONS (IMPORTANTE)
  if (getMethod(event) === "OPTIONS") {
    event.node.res.statusCode = 204;
    return "ok";
  }

  const { slug } = getRouterParams(event);

  let info = await getAnimeInfo(slug).catch(() => null);

  // 🔥 FALLBACK INTELIGENTE (SE CONSERVA TU LÓGICA)
  if (!info) {

    const baseQuery = slug.replace(/-/g, " ");

    const variants = [
      baseQuery,
      baseQuery.replace(/\d+/g, ""),
      baseQuery.split(" ").slice(0, 4).join(" "),
      baseQuery.split(" ").slice(0, 3).join(" "),
    ];

    for (const q of variants) {
      try {
        const results = await searchAnime(q, 1); // 👈 FIX IMPORTANTE

        if (results?.media?.length) {
          const found = results.media[0];

          info = await getAnimeInfo(found.slug).catch(() => null);

          if (info) break;
        }

      } catch (err) {
        // opcional: console.log(err)
      }
    }
  }

  if (!info) {
    throw createError({
      statusCode: 404,
      message: "No se ha encontrado el anime",
    });
  }

  return {
    success: true,
    data: info
  };
});
