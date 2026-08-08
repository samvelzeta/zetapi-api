import { getAllServers } from "../../../../utils/getServers";

export default defineEventHandler(async (event) => {
  setHeader(event, "Access-Control-Allow-Origin", "*");
  if (event.method === "OPTIONS") return "";

  const { slug, number } = getRouterParams(event);
  const { lang, anilistId } = getQuery(event);

  const episode = parseInt(number);
  if (isNaN(episode)) {
    throw createError({ statusCode: 400, message: "Número de episodio inválido" });
  }

  const { servers, latestEpisode } = await getAllServers({
    slug,
    number: episode,
    title: slug,
    anilistId: anilistId ? Number(anilistId) : undefined,
  });

  return {
    success: true,
    source: servers.length ? "scraper" : "empty",
    data: { slug, number: episode, servers, subtitles: [], latestEpisode },
  };
});
