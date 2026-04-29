import { scrapeSeekeEpisode, generateCacheKey } from '../../utils/seekeScraper';

const TELEGRAM_TOKEN = "TU_TOKEN_AQUI";
const CHAT_ID = "1749255245";

// ==============================
// 🔥 LIMPIAR URL (IMPORTANTE)
// ==============================
function cleanUrl(rawUrl: string): string {
  return rawUrl.split("|")[0];
}

// ==============================
// 🔥 TELEGRAM REQUEST (SIN REQ)
// ==============================
async function telegramRequest(url: string, ep: number): Promise<string | null> {
  try {

    // limpiar URL por si viene corrupta del frontend
    const clean = cleanUrl(url);

    // 1. enviar mensaje al bot
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        chat_id: CHAT_ID,
        text: `API|${clean}|${ep}`
      })
    });

    // 2. esperar respuesta
    await new Promise(r => setTimeout(r, 2000));

    // 3. leer updates
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates`);
    const data = await res.json();

    if (!data.result?.length) return null;

    // 4. buscar última respuesta válida
    for (let i = data.result.length - 1; i >= 0; i--) {
      const text = data.result[i]?.message?.text || "";

      const parts = text.split("|");

      if (
        parts[0] === "OK" &&
        parts[1] === ep.toString()
      ) {
        return parts[2];
      }
    }

    return null;

  } catch (e) {
    console.log("❌ TELEGRAM ERROR", e);
    return null;
  }
}

// ==============================
// 🔥 MAIN HANDLER
// ==============================
export default defineEventHandler(async (event) => {
  try {

    const query = getQuery(event);
    const { url, ep } = query;

    if (!url || !ep) {
      return { ok: false, error: "Missing params" };
    }

    const episodeNumber = parseInt(ep as string, 10);

    // 🔥 limpiar URL SIEMPRE
    const baseUrl = cleanUrl(decodeURIComponent(url as string));

    const cacheKey = await generateCacheKey(baseUrl, episodeNumber);
    const env = event.context.cloudflare?.env;

    // =====================
    // CACHE
    // =====================
    if (env?.ANIME_CACHE) {
      const cached = await env.ANIME_CACHE.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    // =====================
    // SEEKE
    // =====================
    const seeke = await scrapeSeekeEpisode(baseUrl, episodeNumber);

    if (seeke.status === "success" && seeke.embed) {
      return {
        ok: true,
        episode: episodeNumber,
        embed: seeke.embed,
        source: "seeke"
      };
    }

    // =====================
    // TELEGRAM BOT
    // =====================
    const botVideo = await telegramRequest(baseUrl, episodeNumber);

    if (botVideo) {

      const res = {
        ok: true,
        episode: episodeNumber,
        embed: botVideo,
        source: "bot"
      };

      if (env?.ANIME_CACHE) {
        await env.ANIME_CACHE.put(cacheKey, JSON.stringify(res));
      }

      return res;
    }

    return { ok: false, error: "No se pudo obtener el episodio" };

  } catch (err) {
    return { ok: false, error: "Server error" };
  }
});
