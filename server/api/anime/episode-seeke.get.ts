import { scrapeSeekeEpisode } from '../../utils/seekeScraper';
import { getAllServers } from '../../utils/getServers';

// 1. ELIMINAMOS la URL fija de aquí.
// Usaremos una variable que se asigne dentro del handler.

function cleanUrl(input: string) {
  if (!input) return "";
  let clean = decodeURIComponent(input);
  clean = clean.split('|')[0].trim();
  clean = clean.replace(/\/+$/, "");
  return clean;
}

function generateSafeKey(url: string, ep: number) {
  const base = url.replace(/^https?:\/\//, "").replace(/[^\w]/g, "_");
  return `${base}_${ep}`;
}

function isValidVideo(url: string) {
  return typeof url === "string" && url.includes(".m3u8");
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { url, ep, slug } = query;

    if (!url || !ep) return { ok: false, error: "missing params" };

    const episodeNumber = parseInt(ep as string, 10);
    const baseUrl = cleanUrl(url as string);

    // 2. OBTENER LA VARIABLE DESDE CLOUDFLARE
    const env = event.context.cloudflare?.env || (globalThis as any);
    
    // Si la variable existe en Cloudflare, úsala. Si no, usa una por defecto para evitar errores.
    const FINAL_BOT_URL = env.BOT_TUNNEL_URL || "https://tu-url-temporal.trycloudflare.com";

    const cacheKey = generateSafeKey(baseUrl, episodeNumber);

    // 1. CACHE KV (Igual que antes...)
    if (env?.ANIME_CACHE) {
      const cached = await env.ANIME_CACHE.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.embed && isValidVideo(parsed.embed)) return parsed;
      }
    }

    // 2. SCRAPER INTERNO (Igual que antes...)
    const seeke = await scrapeSeekeEpisode(baseUrl, episodeNumber);
    if (seeke.status === "success" && isValidVideo(seeke.embed)) {
      const res = { ok: true, episode: episodeNumber, embed: seeke.embed, source: "seeke" };
      if (env?.ANIME_CACHE) await env.ANIME_CACHE.put(cacheKey, JSON.stringify(res));
      return res;
    }

    // 3. LLAMADA AL BOT (TERMUX) - AHORA USA FINAL_BOT_URL
    console.log(`🛠️ Intentando conectar al túnel: ${FINAL_BOT_URL}`);
    try {
      const botRes = await fetch(FINAL_BOT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: baseUrl, ep: episodeNumber }),
        signal: AbortSignal.timeout(15000)
      });

      if (botRes.ok) {
        const data = await botRes.json();
        if (data.ok && isValidVideo(data.embed)) {
          const res = { ok: true, episode: episodeNumber, embed: data.embed, source: "bot" };
          if (env?.ANIME_CACHE) await env.ANIME_CACHE.put(cacheKey, JSON.stringify(res));
          return res;
        }
      }
    } catch (e) {
      console.log("❌ Error en conexión con el bot o túnel offline");
    }

    // 4. FALLBACK FINAL (Igual que antes...)
    if (slug) {
      const servers = await getAllServers({ slug, number: episodeNumber, title: slug, env });
      if (servers?.length && isValidVideo(servers[0].embed)) {
        return { ok: true, episode: episodeNumber, embed: servers[0].embed, source: "fallback" };
      }
    }

    return { ok: false };
  } catch (err) {
    return { ok: false };
  }
});
