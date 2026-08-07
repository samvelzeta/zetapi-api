import { getAllServers } from "../../../../utils/getServers";
import { getJKAnimeSubtitles } from "../../../../utils/jkanime";

export default defineEventHandler(async (event) => {
  setHeader(event, "Access-Control-Allow-Origin", "*");
  if (event.method === "OPTIONS") return "";

  const { slug, number } = getRouterParams(event);
  const { lang, anilistId } = getQuery(event);

  const episode = parseInt(number);
  if (isNaN(episode)) {
    throw createError({ statusCode: 400, message: "Número de episodio inválido" });
  }

  // KV Cache (opcional)
  let cached: any = null;
  try {
    const env = (event.context as any).cloudflare?.env;
    if (env?.ANIME_CACHE) {
      const key = `${slug}:${episode}:${lang || "sub"}`;
      const raw = await env.ANIME_CACHE.get(key);
      if (raw) cached = JSON.parse(raw);
    }
  } catch {}

  if (cached?.servers) {
    return {
      success: true,
      source: "kv",
      data: {
        slug,
        number: episode,
        servers: cached.servers,
        subtitles: cached.subtitles || [],
        latestEpisode: cached.latestEpisode || null,
      },
    };
  }

  const { servers, latestEpisode } = await getAllServers({
    slug,
    number: episode,
    title: slug, // idealmente aquí pasarías el título real desde el frontend
    anilistId: anilistId ? Number(anilistId) : undefined,
  });

  console.log("🔍 Servers encontrados:", servers.length);

  let subtitles: { lang: string; url: string }[] = [];
  try {
    subtitles = await getJKAnimeSubtitles(slug, episode);
  } catch (e) {
    console.log("⚠️ Error subtítulos:", e);
  }

  // Guardar en KV
  if (servers.length) {
    try {
      const env = (event.context as any).cloudflare?.env;
      if (env?.ANIME_CACHE) {
        const key = `${slug}:${episode}:${lang || "sub"}`;
        await env.ANIME_CACHE.put(
          key,
          JSON.stringify({ servers, subtitles, latestEpisode }),
          { expirationTtl: 60 * 60 * 24 * 30 }
        );
      }
    } catch {}
  }

  return {
    success: true,
    source: servers.length ? "scraper" : "empty",
    data: { slug, number: episode, servers, subtitles, latestEpisode },
  };
});
