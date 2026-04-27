/**
 * 🔥 SEEKE SCRAPER - Tu bot bash convertido a TypeScript
 * 
 * Características:
 * - Extrae m3u8 directo de Seeke/clones
 * - Headers anti-bloqueo automáticos
 * - 3 métodos diferentes de búsqueda
 * - Validación de m3u8 accesible
 * - Sin watermark, sin iframe, sin anuncios
 */

interface SeekeScrapeResult {
  episode: number;
  embed: string;
  url: string;
  status: 'success' | 'failed';
  error?: string;
}

/**
 * Generar user-agent aleatorio
 */
function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/118 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Mobile Safari/537.36',
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Obtener headers anti-bloqueo
 */
function getSeekeHeaders(baseUrl: string): HeadersInit {
  const origin = new URL(baseUrl).origin;

  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Referer': origin,
    'Origin': origin,
    'DNT': '1',
    'Cache-Control': 'max-age=0',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
  };
}

/**
 * Método 1: Buscar m3u8 con regex simple
 */
function extractM3U8Method1(html: string): string | null {
  const regex = /https?[^"'<>\s]+\.m3u8[^"'<>\s]*/i;
  const match = html.match(regex);
  if (match) {
    const url = match[0];
    // Limpiar caracteres de cierre
    return url.split(/[\?#"'<>]/)[0];
  }
  return null;
}

/**
 * Método 2: Buscar en atributos de video
 */
function extractM3U8Method2(html: string): string | null {
  const regex = /src\s*=\s*["']?(https?[^"'<>\s]*\.m3u8)[^"'>]*/i;
  const match = html.match(regex);
  if (match) {
    return match[1];
  }
  return null;
}

/**
 * Método 3: Buscar en variables JavaScript
 */
function extractM3U8Method3(html: string): string | null {
  const regex = /["']?(https?[^"'<>\s]*\.m3u8)[^"'<>\s]*["']?\s*[,;:\}]/i;
  const match = html.match(regex);
  if (match) {
    return match[1];
  }
  return null;
}

/**
 * Extraer m3u8 del HTML usando 3 métodos
 */
function extractM3U8FromHTML(html: string): string | null {
  // Intenta método 1
  let m3u8 = extractM3U8Method1(html);
  if (m3u8) {
    console.log(`✅ M3U8 encontrado (Método 1): ${m3u8}`);
    return m3u8;
  }

  // Intenta método 2
  m3u8 = extractM3U8Method2(html);
  if (m3u8) {
    console.log(`✅ M3U8 encontrado (Método 2): ${m3u8}`);
    return m3u8;
  }

  // Intenta método 3
  m3u8 = extractM3U8Method3(html);
  if (m3u8) {
    console.log(`✅ M3U8 encontrado (Método 3): ${m3u8}`);
    return m3u8;
  }

  console.log(`❌ No se encontró m3u8 en el HTML`);
  return null;
}

/**
 * Validar que el m3u8 sea accesible
 */
async function validateM3U8(m3u8Url: string): Promise<boolean> {
  try {
    const response = await fetch(m3u8Url, {
      method: 'HEAD',
      headers: {
        'User-Agent': getRandomUserAgent(),
      },
    });

    const accessible = response.ok || response.status === 200;

    if (accessible) {
      console.log(`✅ M3U8 válido: ${m3u8Url}`);
    } else {
      console.log(`❌ M3U8 no accesible (${response.status}): ${m3u8Url}`);
    }

    return accessible;
  } catch (error) {
    console.log(`❌ Error validando M3U8:`, error);
    return false;
  }
}

/**
 * Scraper principal - Seeke
 * Adapción del bot bash a TypeScript
 */
export async function scrapeSeekeEpisode(
  baseUrl: string,
  episodeNumber: number
): Promise<SeekeScrapeResult> {
  try {
    // 1. Construir URL del episodio
    const episodeUrl = `${baseUrl}/${episodeNumber}`;
    console.log(`🔍 Escaneando: ${episodeUrl}`);

    // 2. Verificar que la página existe (HEAD request)
    try {
      const headResponse = await fetch(episodeUrl, {
        method: 'HEAD',
        headers: getSeekeHeaders(baseUrl),
      });

      if (headResponse.status === 404) {
        return {
          episode: episodeNumber,
          embed: '',
          url: episodeUrl,
          status: 'failed',
          error: 'Episode not found (404)',
        };
      }
    } catch (e) {
      console.log('⚠️ HEAD request falló, intentando GET');
    }

    // 3. Hacer GET request al episodio
    const response = await fetch(episodeUrl, {
      headers: getSeekeHeaders(baseUrl),
      redirect: 'follow',
    });

    if (!response.ok) {
      return {
        episode: episodeNumber,
        embed: '',
        url: episodeUrl,
        status: 'failed',
        error: `HTTP ${response.status}`,
      };
    }

    // 4. Obtener HTML
    const html = await response.text();

    if (!html || html.length < 100) {
      return {
        episode: episodeNumber,
        embed: '',
        url: episodeUrl,
        status: 'failed',
        error: 'Empty or invalid response',
      };
    }

    // 5. Extraer m3u8 del HTML
    const m3u8Url = extractM3U8FromHTML(html);

    if (!m3u8Url) {
      return {
        episode: episodeNumber,
        embed: '',
        url: episodeUrl,
        status: 'failed',
        error: 'No m3u8 found in page',
      };
    }

    // 6. Validar que m3u8 sea accesible
    const isValid = await validateM3U8(m3u8Url);

    if (!isValid) {
      return {
        episode: episodeNumber,
        embed: '',
        url: episodeUrl,
        status: 'failed',
        error: 'M3U8 URL not accessible',
      };
    }

    // 7. Éxito
    return {
      episode: episodeNumber,
      embed: m3u8Url,
      url: episodeUrl,
      status: 'success',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error en scraper:`, error);

    return {
      episode: episodeNumber,
      embed: '',
      url: baseUrl,
      status: 'failed',
      error: errorMessage,
    };
  }
}

/**
 * Función para escanear múltiples episodios (opcional, para bots)
 */
export async function scanMultipleEpisodes(
  baseUrl: string,
  maxEpisodes: number = 200
): Promise<SeekeScrapeResult[]> {
  const results: SeekeScrapeResult[] = [];
  let consecutiveErrors = 0;

  for (let i = 1; i <= maxEpisodes; i++) {
    const result = await scrapeSeekeEpisode(baseUrl, i);

    if (result.status === 'success') {
      results.push(result);
      consecutiveErrors = 0;
      console.log(`✅ EP ${i} OK`);
    } else {
      consecutiveErrors++;
      console.log(`❌ EP ${i} FAILED: ${result.error}`);

      // Si 4 episodios seguidos fallan, asumir fin
      if (consecutiveErrors >= 4) {
        console.log(`🛑 FIN: No más episodios después de EP ${i}`);
        break;
      }
    }

    // Delay para no sobrecargar servidor
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Generar cache key para KV
 */
export async function generateCacheKey(
  baseUrl: string,
  episode: number
): Promise<string> {
  // Usar hash del URL + episodio
  const urlHash = Buffer.from(baseUrl).toString('base64').slice(0, 16);
  return `seeke:${urlHash}:${episode}`;
}
