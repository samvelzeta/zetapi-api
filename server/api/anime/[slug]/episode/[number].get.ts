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

  if (cached?.sources) {
    const servers = [
      ...(cached.sources.hls || []),
      ...(cached.sources.mp4 || []),
      ...(cached.sources.embed || []),
    ].map((u: string) => ({ embed: u, name: "", type: "Externo" })); // reasignar nombres en cache

    if (servers.length) {
      return {
        success: true,
        source: "kv",
        data: { slug, number: episode, servers, subtitles: cached.subtitles || [] },
      };
    }
  }

  // Scraping
  const servers = await getAllServers({
    slug,
    number: episode,
    title: slug,
    anilistId: anilistId ? Number(anilistId) : undefined,
  });

  console.log("🔍 Servers encontrados:", servers.length);

  // Subtítulos
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
          JSON.stringify({
            sources: { embed: servers.map((s) => s.embed) },
            subtitles,
          }),
          { expirationTtl: 60 * 60 * 24 * 30 }
        );
      }
    } catch {}
  }

  return {
    success: true,
    source: servers.length ? "scraper" : "empty",
    data: { slug, number: episode, servers, subtitles },
  };
});
