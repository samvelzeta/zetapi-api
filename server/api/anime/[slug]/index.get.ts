import { getAnimeInfo } from "animeflv-scraper";

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

  // 2. OBTENCIÓN DE PARÁMETROS
  const { slug } = getRouterParams(event) as { slug: string };
  const { lang } = getQuery(event) as { lang?: string };
  
  try {
    let info;

    if (lang === 'latino') {
      // Lógica para extraer info de AnimeLatinoHD
      info = await getLatinoInfo(slug);
    } else {
      // Lógica por defecto (AnimeFLV)
      info = await getAnimeInfo(slug).catch(() => null);
    }

    if (!info) {
      throw createError({
        statusCode: 404,
        message: "No se ha encontrado el anime en la fuente seleccionada",
      });
    }

    return {
      success: true,
      data: info
    };

  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Error al obtener la información",
    });
  }
}, {
  swr: false,
  maxAge: 86400,
  name: "info",
  group: "anime",
  getKey: event => {
    const { slug } = getRouterParams(event);
    const { lang } = getQuery(event);
    return `${slug}-${lang || 'sub'}`; // Cache separado por idioma
  }
});

// --- MOTOR DE INFORMACIÓN LATINO ---

async function getLatinoInfo(slug: string) {
  const url = `https://www.animelatinohd.com/anime/${slug}`;
  
  try {
    const html = await $fetch<string>(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    // Extraemos Sinopsis y Título con Regex
    const title = html.match(/<h1.*?>(.*?)<\/h1>/)?.[1] || slug;
    const synopsis = html.match(/<div class="sinopsis">(.*?)<\/div>/)?.[1] || "Sin sinopsis disponible";
    const cover = html.match(/<div class="anime-poster">[\s\S]*?src="(.*?)"/)?.[1] || "";

    // Extraemos la lista de episodios (Formato simplificado)
    const episodesRegex = /<a href="\/ver\/.*?\/(.*?)"[\s\S]*?<span>Episodio (.*?)<\/span>/g;
    const episodes = [];
    let match;

    while ((match = episodesRegex.exec(html)) !== null) {
      episodes.push({
        number: Number(match[2]),
        slug: `${slug}-${match[2]}`, // Generamos un slug único para el episodio
        url: `https://www.animelatinohd.com/ver/${slug}/${match[2]}`
      });
    }

    return {
      title: title.trim(),
      alternative_titles: [],
      status: "Finalizado",
      rating: "N/A",
      type: "Anime",
      cover: cover,
      synopsis: synopsis.replace(/<[^>]*>?/gm, '').trim(),
      genres: ["Latino"],
      episodes: episodes.reverse(), // De más reciente a más viejo
      url: url
    };
  } catch (e) {
    return null;
  }
}

// TU DOCUMENTACIÓN OPENAPI SE MANTIENE ABAJO...
