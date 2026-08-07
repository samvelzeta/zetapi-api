import { getAllServers, getSubtitles } from "../../../../utils/getServers";

export default defineEventHandler(async (event) => {
  // CORS básico
  setHeader(event, "Access-Control-Allow-Origin", "*");
  if (event.method === "OPTIONS") return "";

  const { slug, number } = getRouterParams(event);
  const { lang } = getQuery(event);

  const episode = parseInt(number);
  if (isNaN(episode)) {
    throw createError({ statusCode: 400, message: "Número de episodio inválido" });
  }

  // --- Intentar KV (si está disponible, si no, lo ignora) ---
  let cached: any = null;
  try {
    const env = (event.context as any).cloudflare?.env;
    if (env?.ANIME_CACHE) {
      const key = `${slug}:${episode}:${lang || "sub"}`;
      const raw = await env.ANIME_CACHE.get(key);
      if (raw) cached = JSON.parse(raw);
    }
  } catch {
    // sin KV
  }

  if (cached?.sources) {
    const servers = [
      ...(cached.sources.hls || []),
      ...(cached.sources.mp4 || []),
      ...(cached.sources.embed || []),
    ].map((u: string) => ({ embed: u }));

    if (servers.length) {
      console.log("⚡ Servido desde KV");
      return {
        success: true,
        source: "kv",
        data: {
          slug,
          number: episode,
          servers,
          subtitles: cached.subtitles || [],
        },
      };
    }
  }

  // --- Scraping ---
  const servers = await getAllServers({
    slug,
    number: episode,
    title: slug,
  });

  console.log("🔍 Servers encontrados:", servers.length);

  // Subtítulos (solo JKAnime)
  let subtitles: { lang: string; url: string }[] = [];
  try {
    subtitles = await getSubtitles(slug, episode);
    console.log("🎯 Subtítulos:", subtitles.length);
  } catch (e) {
    console.log("⚠️ Error obteniendo subtítulos:", e);
  }

  // --- Guardar en KV (si existe) ---
  if (servers.length) {
    try {
      const env = (event.context as any).cloudflare?.env;
      if (env?.ANIME_CACHE) {
        const key = `${slug}:${episode}:${lang || "sub"}`;
        const payload = {
          sources: {
            embed: servers.map((s) => s.embed),
          },
          subtitles,
        };
        await env.ANIME_CACHE.put(key, JSON.stringify(payload), {
          expirationTtl: 60 * 60 * 24 * 30, // 30 días
        });
        console.log("💾 KV guardado");
      }
    } catch {
      // sin KV
    }

    return {
      success: true,
      source: "scraper",
      data: {
        slug,
        number: episode,
        servers,
        subtitles,
      },
    };
  }

  // --- Sin resultados ---
  return {
    success: true,
    source: "empty",
    data: {
      slug,
      number: episode,
      servers: [],
      subtitles: [],
    },
  };
});
