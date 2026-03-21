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
      info = await getLatinoInfo(slug);
    } else {
      // AnimeFLV (Subtitulado)
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
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 10000
    });

    // Extraemos Datos con Regex
    const title = html.match(/<h1.*?>(.*?)<\/h1>/)?.[1] || slug;
    const synopsisMatch = html.match(/<div class="sinopsis">([\s\S]*?)<\/div>/)?.[1] || "Sin sinopsis disponible";
    const cover = html.match(/<div class="anime-poster">[\s\S]*?src="(.*?)"/)?.[1] || "";

    // Extraemos la lista de episodios
    const episodesRegex = /href="\/ver\/.*?\/(\d+)"/g;
    const episodes = [];
    let match;

    while ((match = episodesRegex.exec(html)) !== null) {
      const epNum = match[1];
      episodes.push({
        number: Number(epNum),
        url: `/api/anime/${slug}/episode/${epNum}?lang=latino`
      });
    }

    return {
      title: title.trim(),
      type: "Anime",
      cover: cover,
      synopsis: synopsisMatch.replace(/<[^>]*>?/gm, '').trim(),
      genres: ["Latino"],
      episodes: episodes.sort((a, b) => b.number - a.number),
      source: "latino"
    };
  } catch (e) {
    return null;
  }
}

// --- DOCUMENTACIÓN OPENAPI ---
defineRouteMeta({
  openAPI: {
    tags: ["Anime"],
    summary: "Detalles del Anime y Lista de Episodios",
    description: "Obtiene la información completa de un anime (sinopsis, géneros, episodios) filtrada por idioma (Sub o Latino).",
    parameters: [
      {
        name: "slug",
        in: "path",
        required: true,
        description: "Slug único del anime (ej: black-clover)",
        schema: { type: "string" }
      },
      {
        name: "lang",
        in: "query",
        description: "Idioma: 'latino' para AnimeLatinoHD o vacío para Subtitulado",
        schema: { type: "string", enum: ["latino", ""] }
      }
    ],
    responses: {
      200: { description: "Información cargada correctamente" },
      404: { description: "Anime no encontrado" }
    }
  }
});
