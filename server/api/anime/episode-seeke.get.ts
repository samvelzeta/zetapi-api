import { scrapeSeekeEpisode, generateCacheKey } from '../../../utils/seekeScraper';
import { getAllServers } from '../../../utils/getServers';

interface EpisodeResponse {
  ok: boolean;
  episode: number;
  embed: string;
  source: 'seeke' | 'fallback' | 'cache';
  url: string;
  cached: boolean;
  error?: string;
}

/**
 * 🔥 NUEVO ENDPOINT - SEEKE SCRAPER
 * 
 * GET /api/anime/episode-seeke?url=BASE_URL&ep=NUM
 * 
 * Ejemplo:
 * GET /api/anime/episode-seeke?url=https://example.com/anime/naruto&ep=5
 * 
 * Respuesta:
 * {
 *   "ok": true,
 *   "episode": 5,
 *   "embed": "https://...m3u8",
 *   "source": "seeke",
 *   "url": "https://example.com/anime/naruto",
 *   "cached": false
 * }
 */
export default defineEventHandler(async (event) => {
  try {
    // 🔥 1. VALIDAR QUERY PARAMS
    const query = getQuery(event);
    const { url, ep, slug } = query;

    if (!url || !ep) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          error: 'Missing required params: url and ep',
        }),
      };
    }

    const episodeNumber = parseInt(ep as string, 10);
    const baseUrl = decodeURIComponent(url as string);

    if (isNaN(episodeNumber) || episodeNumber < 1) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          ok: false,
          error: 'Invalid episode number',
        }),
      };
    }

    console.log(`🎬 Solicitud: ${baseUrl} EP ${episodeNumber}`);

    // 🔥 2. VERIFICAR CACHE KV (OPCIONAL)
    let cacheKey: string | null = null;
    try {
      cacheKey = await generateCacheKey(baseUrl, episodeNumber);
      const env = event.context.cloudflare?.env || (globalThis as any);

      if (env?.ANIME_CACHE) {
        const cached = await env.ANIME_CACHE.get(cacheKey);
        if (cached) {
          console.log(`⚡ CACHE HIT: ${cacheKey}`);
          const response: EpisodeResponse = JSON.parse(cached);
          response.cached = true;

          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          };
        }
      }
    } catch (e) {
      console.log('⚠️ KV Cache no disponible:', e);
    }

    // 🔥 3. INTENTAR SCRAPER SEEKE (PRINCIPAL)
    console.log(`🔍 Intentando SEEKE scraper...`);
    const seekeResult = await scrapeSeekeEpisode(baseUrl, episodeNumber);

    if (seekeResult.status === 'success' && seekeResult.embed) {
      console.log(`✅ SEEKE ÉXITO: ${seekeResult.embed}`);

      const response: EpisodeResponse = {
        ok: true,
        episode: episodeNumber,
        embed: seekeResult.embed,
        source: 'seeke',
        url: baseUrl,
        cached: false,
      };

      // 🔥 GUARDAR EN CACHE
      try {
        const env = event.context.cloudflare?.env || (globalThis as any);
        if (env?.ANIME_CACHE && cacheKey) {
          await env.ANIME_CACHE.put(
            cacheKey,
            JSON.stringify(response),
            { expirationTtl: 60 * 60 * 24 * 30 } // 30 días
          );
          console.log(`💾 Guardado en cache: ${cacheKey}`);
        }
      } catch (e) {
        console.log('⚠️ No se pudo guardar en cache:', e);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      };
    }

    console.log(`❌ SEEKE falló: ${seekeResult.error}`);

    // 🔥 4. FALLBACK: USAR MÉTODO LEGACY (getAllServers)
    if (slug) {
      console.log(`⚠️ Intentando fallback con slug: ${slug}`);

      try {
        const env = event.context.cloudflare?.env || (globalThis as any);
        const servers = await getAllServers({
          slug: slug as string,
          number: episodeNumber,
          title: slug,
          env,
        });

        if (servers && servers.length > 0) {
          console.log(`✅ FALLBACK ÉXITO: ${servers[0].embed}`);

          const response: EpisodeResponse = {
            ok: true,
            episode: episodeNumber,
            embed: servers[0].embed,
            source: 'fallback',
            url: baseUrl,
            cached: false,
          };

          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          };
        }
      } catch (fallbackError) {
        console.error('❌ Fallback también falló:', fallbackError);
      }
    }

    // 🔥 5. TODO FALLÓ
    console.log(`🛑 No se pudo obtener el episodio`);

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        episode: episodeNumber,
        embed: '',
        error: 'No se pudo obtener el episodio. Intenta con otro servidor o idioma.',
      } as EpisodeResponse),
    };
  } catch (error) {
    console.error('❌ Error general:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
    };
  }
});
