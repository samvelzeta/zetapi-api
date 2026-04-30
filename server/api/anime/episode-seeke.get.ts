import { scrapeSeekeEpisode } from '../../utils/seekeScraper';
import { getAllServers } from '../../utils/getServers';

// URL del bot en JustRunMyApp (Ya no es de Termux)
const BOT_URL = "https://a23292-7f5b.c.jrnm.app"; 

function cleanUrl(input: string) {
  if (!input) return "";
  let clean = decodeURIComponent(input);
  // Limpiamos el separador "|" y espacios sobrantes
  clean = clean.split('|')[0].trim();
  // Quitamos barras finales para evitar URLs inválidas
  clean = clean.replace(/\/+$/, "");
  return clean;
}

function generateSafeKey(url: string, ep: number) {
  const base = url
    .replace(/^https?:\/\//, "")
    .replace(/[^\w]/g, "_");
  
  // ARREGLADO: Ahora usa backticks (``) para que el template string funcione correctamente
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

    // Ajuste para obtener el entorno de Cloudflare o global
    const env = event.context.cloudflare?.env || (globalThis as any);
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

    // 3. BOT EXTERNO (JustRunMyApp / Hosting)
    let data: any = null;
    try {
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
