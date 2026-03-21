import { searchAnime } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  });

  if (getMethod(event) === 'OPTIONS') return 'ok';

  const { query, page, lang } = getQuery(event) as { query: string, page: string, lang?: string };
  
  if (!query) throw createError({ statusCode: 400, message: "Query requerida" });

  try {
    let results;

    if (lang === 'latino') {
      results = await searchAnimeLatino(query);
    } else {
      results = await searchAnime(query, Number(page) || 1);
    }

    return { success: true, data: results };

  } catch (error: any) {
    throw createError({ statusCode: 500, message: error.message });
  }
});

async function searchAnimeLatino(query: string) {
  // Cambiamos la URL a la de búsqueda por JSON que es más rápida
  const url = `https://www.animelatinohd.com/api/anime/search?q=${encodeURIComponent(query)}`;
  
  try {
    const response = await $fetch<any>(url, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://www.animelatinohd.com/"
      },
      timeout: 10000
    });

    // Si la web nos devuelve un JSON directo (algunas APIs lo hacen)
    if (Array.isArray(response)) {
        return {
            currentPage: 1,
            media: response.map((a: any) => ({
                title: a.title,
                cover: a.poster,
                slug: a.slug,
                url: `/api/anime/${a.slug}?lang=latino`,
                source: "latino"
            }))
        };
    }

    return { currentPage: 1, media: [] };
  } catch (e) {
    // Si falla el API, intentamos el Scraper anterior pero con el nuevo User-Agent
    return fallbackSearchLatino(query);
  }
}

async function fallbackSearchLatino(query: string) {
    const url = `https://www.animelatinohd.com/busqueda?q=${encodeURIComponent(query)}`;
    const html = await $fetch<string>(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    const regex = /<div class="anime-card">[\s\S]*?href="\/anime\/(.*?)"[\s\S]*?src="(.*?)"[\s\S]*?<h3.*?>(.*?)<\/h3>/g;
    const media = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        media.push({
            title: match[3].trim(),
            cover: match[2].startsWith('http') ? match[2] : `https://www.animelatinohd.com${match[2]}`,
            slug: match[1],
            url: `/api/anime/${match[1]}?lang=latino`,
            source: "latino"
        });
    }
    return { currentPage: 1, media };
}
