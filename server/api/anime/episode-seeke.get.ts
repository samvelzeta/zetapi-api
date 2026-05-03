import { scrapeSeekeEpisode } from '../../utils/seekeScraper';
import { getAllServers } from '../../utils/getServers';

function cleanUrl(input: string) {
  if (!input) return "";
  let clean = decodeURIComponent(input);
  clean = clean.split('|')[0].trim();
  clean = clean.replace(/\/+$/, "");
  return clean;
}

function generateSafeKey(url: string, ep: number, lang: string) {
  const base = url
    .replace(/^https?:\/\//, "")
    .replace(/[^\w]/g, "_");
  return `${base}_${ep}_${lang}`;
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
    
    // URL del bot en JustRunMyApp
    const BOT_URL = env.BOT_TUNNEL_URL || "https://a23784-9489.xs001.jrnm.app";
    const cacheKey = generateSafeKey(baseUrl, episodeNumber, lang as string);

    // 1. REVISAR CACHÉ (KV)
    if (env?.ANIME_CACHE) {
      const cached = await env.ANIME_CACHE.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.embed && isValidVideo(parsed.embed)) {
          return parsed;
        }
      }
    }

    let responseData: any = null;

    // 2. PRIORIDAD: JAPONÉS -> VA DIRECTO AL BOT PARA SOFT-SUBS
    // Si es latino, intentamos Seeke primero para ahorrar recursos del VPS
    if (lang === 'lat') {
      const seeke = await scrapeSeekeEpisode(baseUrl, episodeNumber);
      if (seeke.status === "success" && isValidVideo(seeke.embed)) {
        responseData = { 
          ok: true, 
          episode: episodeNumber, 
          embed: seeke.embed, 
          source: "seeke",
          type: "hardsubs",
          subtitles: [] 
        };
      }
    }

    // 3. BOT EXTERNO (JustRunMyApp)
    // Se activa si es Japonés O si el scraper de Latino falló
    if (!responseData) {
      try {
        // Añadimos un AbortController para no dejar la petición de Cloudflare colgada infinitamente
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seg máximo

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
              // Recibimos los subtítulos mapeados por el bot (data-url y data-text)
              subtitles: data.subtitles || [], 
              type: data.type || (lang === 'jp' ? "softsubs" : "hardsubs"),
              source: "vps_bot" 
            };
          }
        }
      } catch (e) {
        console.log("⚠️ VPS_BOT_TIMEOUT o ERROR:", e);
      }
    }

    // 4. FALLBACK (Último recurso)
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
          source: "fallback",
          type: "hardsubs",
          subtitles: []
        };
      }
    }

    // 5. GUARDAR EN CACHÉ Y RETORNAR
    if (responseData) {
      if (env?.ANIME_CACHE) {
        // Cacheamos por 24 horas para no saturar el VPS con las mismas peticiones
        await env.ANIME_CACHE.put(cacheKey, JSON.stringify(responseData), { expirationTtl: 86400 });
      }
      return responseData;
    }

    return { ok: false, error: "no_source_found" };

  } catch (err: any) {
    console.error("💥 API ERROR:", err.message);
    return { ok: false, error: "internal_server_error" };
  }
});
