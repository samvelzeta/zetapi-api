import { getAnimeInfo, searchAnime } from "animeflv-scraper";

export default defineEventHandler(async (event) => {

  setResponseHeaders(event, {
    "Access-Control-Allow-Origin": "*",
  });

  const { slug } = getRouterParams(event);

  let info = await getAnimeInfo(slug).catch(() => null);

  // 🔥 FALLBACK INTELIGENTE
  if (!info) {

    const baseQuery = slug.replace(/-/g, " ");

    const variants = [
      baseQuery,
      baseQuery.replace(/\d+/g, ""), // quitar números
      baseQuery.split(" ").slice(0, 4).join(" "), // primeras palabras
      baseQuery.split(" ").slice(0, 3).join(" "),
    ];

    for (const q of variants) {
      try {
        const results = await searchAnime(q);

        if (results?.media?.length) {
          const found = results.media[0];

          info = await getAnimeInfo(found.slug).catch(() => null);

          if (info) break;
        }

      } catch {}
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
