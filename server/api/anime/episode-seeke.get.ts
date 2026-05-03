import { scrapeSeekeEpisode } from '../../utils/seekeScraper';
import { getAllServers } from '../../utils/getServers';

// Limpieza de URLs para evitar duplicados en caché
function cleanUrl(input: string) {
  if (!input) return "";
  let clean = decodeURIComponent(input);
  clean = clean.split('|')[0].trim();
  clean = clean.replace(/\/+$/, "");
  return clean;
}

// Generar llave de caché única por idioma y episodio
function generateSafeKey(url: string, ep: number, lang: string) {
  const base = url
    .replace(/^https?:\/\//, "")
    .replace(/[^\w]/g, "_");
  return `v2_${base}_${ep}_${lang}`;
}

function isValidVideo(url: string) {
  return typeof url === "string" && url.includes(".m3u8");
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { url, ep, slug, lang = 'lat' } = query;

    if (!url || !ep) {
      return { ok: false, error: "missing params" };
    }

    const episodeNumber = parseInt(ep as string, 10);
    const baseUrl = cleanUrl(url as string);
    const env = event.context.cloudflare?.env || (globalThis as any);
    
    // URL dinámica desde el panel de Cloudflare (Secret)
    const BOT_URL = env.BOT_TUNNEL_URL || "https://a23784-9489.xs001.jrnm.app";
    const cacheKey = generateSafeKey(baseUrl, episodeNumber, lang as string);

    // 1. REVISAR CACHÉ (KV) - Prioridad 1
    if (env?.ANIME_CACHE) {
      const cached = await env.ANIME_CACHE.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.embed && isValidVideo(parsed.embed)) {
          return { ...parsed, source: "kv_cache" };
        }
      }
    }

    let responseData: any = null;

    // 2. SCRAPER INTERNO (Solo Latino) - Prioridad 2
    if (lang === 'lat') {
      const seeke = await scrapeSeekeEpisode(baseUrl, episodeNumber);
      if (seeke.status === "success" && isValidVideo(seeke.embed)) {
        responseData = { 
          ok: true, 
          episode: episodeNumber, 
          embed: seeke.embed, 
          source: "seeke_internal",
          type: "hardsubs",
          subtitles: [] 
        };
      }
    }

    // 3. BOT EXTERNO (VPS - JustRunMyApp) - Prioridad 3
    // Se activa para JAPONÉS o si el scraper interno de Latino falló
    if (!responseData) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 50000); // 50s para Puppeteer

        const botRes = await fetch(BOT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: baseUrl, ep: episodeNumber, lang }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (botRes.ok) {
          const data = await botRes.json();
          if (data && data.ok && isValidVideo(data.embed)) {
            responseData = { 
              ok: true, 
              episode: episodeNumber, 
              embed: data.embed, 
              subtitles: data.subtitles || [], 
              type: data.type || (lang === 'jp' ? "softsubs" : "hardsubs"),
              source: "vps_bot" 
            };
          }
        }
      } catch (e) {
        console.log("⚠️ ERROR CONEXIÓN VPS:", e);
      }
    }

    // 4. FALLBACK (Servidores secundarios si todo lo anterior falla)
    if (!responseData && slug) {
      const servers = await getAllServers({ 
        slug: slug as string, 
        number: episodeNumber, 
        title: slug as string, 
        env 
      });
      
      if (servers?.length && isValidVideo(servers[0].embed)) {
        responseData = { 
          ok: true, 
          episode: episodeNumber, 
          embed: servers[0].embed, 
          source: "fallback_allservers",
          type: "hardsubs",
          subtitles: []
        };
      }
    }

    // 5. GUARDAR Y RETORNAR
    if (responseData) {
      if (env?.ANIME_CACHE) {
        // Guardamos 24 horas (86400 segundos)
        await env.ANIME_CACHE.put(cacheKey, JSON.stringify(responseData), { expirationTtl: 86400 });
      }
      return responseData;
    }

    return { ok: false, error: "no_sources_available" };

  } catch (err: any) {
    console.error("💥 CRITICAL API ERROR:", err.message);
    return { ok: false, error: "internal_server_error" };
  }
});
