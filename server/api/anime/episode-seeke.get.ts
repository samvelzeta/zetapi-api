import { scrapeSeekeEpisode } from '../../utils/seekeScraper';
import { getAllServers } from '../../utils/getServers';

function cleanUrl(input: string) {
  if (!input) return "";
  let clean = decodeURIComponent(input);
  clean = clean.split('|')[0].trim();
  clean = clean.replace(/\/+$/, "");
  return clean;
}

// Modificado: El caché ahora diferencia entre versiones (lat/jp)
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
    // Extraemos 'lang' de la query (por defecto 'lat')
    const { url, ep, slug, lang = 'lat' } = query;

    if (!url || !ep) {
      return { ok: false, error: "missing params" };
    }

    const episodeNumber = parseInt(ep as string, 10);
    const baseUrl = cleanUrl(url as string);
    const env = event.context.cloudflare?.env || (globalThis as any);
    
    // URL dinámica desde el panel de Cloudflare
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

    // 2. SCRAPER INTERNO (Solo para Latino por eficiencia)
    if (lang === 'lat') {
      const seeke = await scrapeSeekeEpisode(baseUrl, episodeNumber);
      if (seeke.status === "success" && isValidVideo(seeke.embed)) {
        responseData = { 
          ok: true, 
          episode: episodeNumber, 
          embed: seeke.embed, 
          source: "seeke",
          type: "hardsubs" 
        };
      }
    }

    // 3. BOT EXTERNO (JustRunMyApp) - Se activa si es Japonés o si Seeke falló
    if (!responseData) {
      try {
        const botRes = await fetch(BOT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Enviamos 'lang' para activar el sensor de subtítulos en la VPS
          body: JSON.stringify({ url: baseUrl, ep: episodeNumber, lang })
        });

        if (botRes.ok) {
          const data = await botRes.json();
          if (data && data.ok && isValidVideo(data.embed)) {
            responseData = { 
              ok: true, 
              episode: episodeNumber, 
              embed: data.embed, 
              subtitles: data.subtitles || [], // Array de subs si existen
              type: data.type || "raw",
              source: "vps_bot" 
            };
          }
        }
      } catch (e) {
        console.log("❌ BOT ERROR:", e);
      }
    }

    // 4. FALLBACK (Último recurso - mayormente para latino)
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
          type: "hardsubs"
        };
      }
    }

    // GUARDAR EN CACHÉ SI TUVIMOS ÉXITO
    if (responseData) {
      if (env?.ANIME_CACHE) {
        await env.ANIME_CACHE.put(cacheKey, JSON.stringify(responseData), { expirationTtl: 86400 });
      }
      return responseData;
    }

    return { ok: false };
  } catch (err: any) {
    console.error("💥 CRITICAL API ERROR:", err.message);
    return { ok: false, error: "internal server error" };
  }
});
