import { scrapeSeekeEpisode } from '../../utils/seekeScraper';
import { getAllServers } from '../../utils/getServers';

function cleanUrl(input: string) {
  if (!input) return "";
  let clean = decodeURIComponent(input);
  clean = clean.split('|')[0].trim();
  clean = clean.replace(/\/+$/, "");
  return clean;
}

function generateSafeKey(url: string, ep: number) {
  const base = url
    .replace(/^https?:\/\//, "")
    .replace(/[^\w]/g, "_");
  return `${base}_${ep}`;
}

function isValidVideo(url: string) {
  return typeof url === "string" && url.includes(".m3u8");
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { url, ep, slug } = query;

    if (!url || !ep) {
      return { ok: false, error: "missing params" };
    }

    const episodeNumber = parseInt(ep as string, 10);
    const baseUrl = cleanUrl(url as string);

    // 🛠️ CONFIGURACIÓN DE VARIABLES DE ENTORNO
    // En Cloudflare Workers/Pages, las variables están en event.context.cloudflare.env
    const env = event.context.cloudflare?.env || (process.env as any);
    
    // Leemos la variable 'BOT_TUNNEL_URL' que configuraste en Settings
    const BOT_URL = env.BOT_TUNNEL_URL;

    if (!BOT_URL) {
      console.warn("⚠️ Advertencia: BOT_TUNNEL_URL no está definida en Cloudflare Settings.");
    }

    const cacheKey = generateSafeKey(baseUrl, episodeNumber);

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

    // 2. SCRAPER INTERNO (SEEKE)
    const seeke = await scrapeSeekeEpisode(baseUrl, episodeNumber);
    if (seeke.status === "success" && isValidVideo(seeke.embed)) {
      const res = { ok: true, episode: episodeNumber, embed: seeke.embed, source: "seeke" };
      if (env?.ANIME_CACHE) await env.ANIME_CACHE.put(cacheKey, JSON.stringify(res));
      return res;
    }

    // 3. BOT EXTERNO (JustRunMyApp)
    let data: any = null;
    if (BOT_URL) {
      try {
        console.log(`📡 Llamando al bot en: ${BOT_URL}`);
        const botRes = await fetch(BOT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: baseUrl, ep: episodeNumber })
        });

        if (botRes.ok) {
          const text = await botRes.text();
          data = JSON.parse(text);
        }
      } catch (e) {
        console.log("❌ BOT ERROR:", e);
      }
    }

    if (data && data.ok && isValidVideo(data.embed)) {
      const res = { ok: true, episode: episodeNumber, embed: data.embed, source: "bot" };
      if (env?.ANIME_CACHE) await env.ANIME_CACHE.put(cacheKey, JSON.stringify(res));
      return res;
    }

    // 4. FALLBACK (Último recurso)
    if (slug) {
      const servers = await getAllServers({ 
        slug: slug as string, 
        number: episodeNumber, 
        title: slug as string, 
        env 
      });
      
      if (servers?.length && isValidVideo(servers[0].embed)) {
        return { ok: true, episode: episodeNumber, embed: servers[0].embed, source: "fallback" };
      }
    }

    return { ok: false };
  } catch (err: any) {
    console.error("💥 CRITICAL API ERROR:", err.message);
    return { ok: false, error: "internal server error" };
  }
});
