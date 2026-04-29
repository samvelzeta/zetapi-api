import { scrapeSeekeEpisode, generateCacheKey } from '../../utils/seekeScraper';

const TELEGRAM_TOKEN = "TU_TOKEN";
const CHAT_ID = "1749255245";

// ==============================
// 🔥 TELEGRAM REQUEST (MEJORADO)
// ==============================
async function telegramRequest(url: string, ep: number): Promise<string | null> {
  try {

    const requestId = Date.now(); // 🔥 identificador único

    // enviar comando
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        chat_id: CHAT_ID,
        text: `API|${url}|${ep}|${requestId}`
      })
    });

    // esperar respuesta
    await new Promise(r => setTimeout(r, 2000));

    // leer updates
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates`);
    const data = await res.json();

    if (!data.result?.length) return null;

    // buscar la respuesta correcta
    for (let i = data.result.length - 1; i >= 0; i--) {
      const text = data.result[i]?.message?.text || "";

      if (text.includes(`|${ep}|`) && text.startsWith("OK|")) {
        return text.split("|")[2];
      }
    }

    return null;

  } catch {
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
      return { ok: false };
    }

    const episodeNumber = parseInt(ep as string, 10);
    const baseUrl = decodeURIComponent(url as string);

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
    // SEEKE (primero)
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

    return { ok: false };

  } catch {
    return { ok: false };
  }
});
