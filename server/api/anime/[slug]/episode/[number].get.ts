import { getAllServers } from "../../../../utils/getServers";
import { getJKAnimeSubtitles } from "../../../../utils/jkanime";

export default defineEventHandler(async (event) => {
  setHeader(event, "Access-Control-Allow-Origin", "*");
  if (event.method === "OPTIONS") return "";

  const { slug, number } = getRouterParams(event);
  const { lang, anilistId, season } = getQuery(event);

  const episode = parseInt(number);
  if (isNaN(episode)) {
    throw createError({
      statusCode: 400,
      message: "Número de episodio inválido",
    });
  }

  const seasonNum = season ? parseInt(season) : undefined;
  const language = lang === "dub" || lang === "latino" ? "dub" : "sub";

  // ─── KV Cache ───
  let cached: any = null;
  try {
    const env = (event.context as any).cloudflare?.env;
    if (env?.ANIME_CACHE) {
      const key = `${slug}:${episode}:${language}:${seasonNum || 1}`;
      const raw = await env.ANIME_CACHE.get(key);
      if (raw) cached = JSON.parse(raw);
    }
  } catch {}

  if (cached?.sources) {
    const servers = cached.sources.map((e: string) => ({
      embed: e,
      name: "",
      type: "embed",
      lang: language,
    }));
    // Reasignar nombres genéricos para mantener consistencia
    const unique = servers.filter(
      (s: any, i: number, arr: any[]) =>
        arr.findIndex((t: any) => t.embed.split("?")[0] === s.embed.split("?")[0]) === i
    );
    const finalServers = unique.slice(0, 15).map((s: any, i: number) => ({
      ...s,
      name: `Servidor ${i + 1}${language === "dub" ? " (Dub)" : ""}`,
    }));

    return {
      success: true,
      source: "kv",
      data: {
        slug,
        number: episode,
        servers: finalServers,
        subtitles: cached.subtitles || [],
      },
    };
  }

  // ─── Scraping ───
  const servers = await getAllServers({
    slug,
    number: episode,
    title: slug,
    anilistId: anilistId ? Number(anilistId) : undefined,
    lang: language,
    season: seasonNum,
  });

  console.log("🔍 Servers encontrados:", servers.length);

  // Subtítulos (solo JKAnime para sub)
  let subtitles: { lang: string; url: string }[] = [];
  try {
    if (language === "sub") {
      subtitles = await getJKAnimeSubtitles(slug, episode);
    }
  } catch (e) {
    console.log("⚠️ Error subtítulos:", e);
  }

  // ─── Guardar KV ───
  if (servers.length) {
    try {
      const env = (event.context as any).cloudflare?.env;
      if (env?.ANIME_CACHE) {
        const key = `${slug}:${episode}:${language}:${seasonNum || 1}`;
        await env.ANIME_CACHE.put(
          key,
          JSON.stringify({
            sources: servers.map((s) => s.embed),
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
    data: {
      slug,
      number: episode,
      servers,
      subtitles,
    },
  };
});
