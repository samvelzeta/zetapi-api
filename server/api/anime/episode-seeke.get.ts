import { scrapeSeekeEpisode } from '../../utils/seekeScraper';
import { getAllServers } from '../../utils/getServers';

// URL del túnel (Asegúrate de que sea la de tu última captura)
const BOT_URL = "https://converter-assisted-assistant-obj.trycloudflare.com"; 

function cleanUrl(input: string) {
  if (!input) return "";
  let clean = decodeURIComponent(input);
  clean = clean.split('|')[0].trim();
  clean = clean.replace(/\/+$/, "");
  return clean;
}

function generateSafeKey(url: string, ep: number) {
  const base = url.replace(/^https?:\/\//, "").replace(/[^\w]/g, "_");
  // CORREGIDO: Uso de backticks para evitar el error de compilación
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

    const env = event.context.cloudflare?.env || (globalThis as any);
    const cacheKey = generateSafeKey(baseUrl, episodeNumber);

    // 1. CACHE KV
    if (env?.ANIME_CACHE) {
      const cached = await env.ANIME_CACHE.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.embed && isValidVideo(parsed.embed)) return parsed;
      }
    }

    // 2. SCRAPER INTERNO
    const seeke = await scrapeSeekeEpisode(baseUrl, episodeNumber);
    if (seeke.status === "success" && isValidVideo(seeke.embed)) {
      const res = { ok: true, episode: episodeNumber, embed: seeke.embed, source: "seeke" };
      if (env?.ANIME_CACHE) await env.ANIME_CACHE.put(cacheKey, JSON.stringify(res));
      return res;
    }

    // 3. LLAMADA AL BOT (TERMUX)
    console.log("🛠️ Intentando obtener desde Bot en Bello...");
    try {
      const botRes = await fetch(BOT_URL, {
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
      console.log("❌ Error en conexión con el bot");
    }

    // 4. FALLBACK FINAL
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
