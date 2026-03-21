import { getEpisode } from "animeflv-scraper";

export default defineCachedEventHandler(async (event) => {
  // 1. CONFIGURACIÓN DE CORS
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

  // 2. PARÁMETROS
  const { slug, number } = getRouterParams(event) as { slug: string, number: string };
  const { lang } = getQuery(event) as { lang?: string };
  
  try {
    let episodeData;

    if (lang === 'latino') {
      episodeData = await getLatinoEpisode(slug, number);
    } else {
      // AnimeFLV (Subtitulado)
      episodeData = await getEpisode(slug, Number(number));
    }

    if (!episodeData || (episodeData.servers && episodeData.servers.length === 0)) {
      throw createError({
        statusCode: 404,
        message: "No se han encontrado servidores para este episodio",
      });
    }

    return {
      success: true,
      data: episodeData
    };

  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Error al cargar el video del episodio",
    });
  }
}, {
  swr: false,
  maxAge: 86400,
  name: "episode",
  group: "anime",
  getKey: (event) => {
    const { slug, number } = getRouterParams(event);
    const { lang } = getQuery(event);
    return `${slug}-${number}-${lang || 'sub'}`;
  }
});

// --- MOTOR DE EPISODIOS LATINO (BLINDADO) ---

async function getLatinoEpisode(slug: string, number: string) {
  const url = `https://www.animelatinohd.com/ver/${slug}/${number}`;
  
  try {
    const html = await $fetch<string>(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 10000
    });

    const servers = [];

    // Buscamos el JSON de videos que suele estar en un script
    const videoDataMatch = html.match(/var\s+video\s*=\s*(\[.*?\]);/);
    
    if (videoDataMatch) {
      try {
        const videos = JSON.parse(videoDataMatch[1]);
        for (const vid of videos) {
          // Limpiamos el embed si viene con HTML
          const cleanEmbed = vid.code.match(/src="(.*?)"/)?.[1] || vid.code;
          
          servers.push({
            name: (vid.server || "Server").toUpperCase(),
            embed: cleanEmbed,
            title: vid.title || "Latino",
          });
        }
      } catch (e) {
        console.error("Error parseando JSON de video latino");
      }
    }

    // Backup: Si el JSON falla, intentamos capturar cualquier iframe de video
    if (servers.length === 0) {
      const iframeRegex = /<iframe.*?src="(.*?)"/g;
      let m;
      while ((m = iframeRegex.exec(html)) !== null) {
        if (m[1].includes('embed') || m[1].includes('player')) {
          servers.push({
            name: "DIRECT-LINK",
            embed: m[1],
            title: "Opcion Alternativa"
          });
        }
      }
    }

    return {
      title: `${slug.replace(/-/g, " ")} - Episodio ${number}`,
      number: Number(number),
      servers: servers
    };
  } catch (e) {
    return null;
  }
}
