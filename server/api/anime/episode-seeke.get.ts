import { scrapeSeekeEpisode, generateCacheKey } from '../../../utils/seekeScraper';
import { getAllServers } from '../../../utils/getServers';

const TELEGRAM_TOKEN = "8767809201:AAHhCa63uxL5yIMolv5CxMsgdgrPQOBuJgY";
const CHAT_ID = "1749255245";

async function telegramRequest(url: string, ep: number) {
  try {

    // 🔥 1. ENVIAR MENSAJE
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        chat_id: CHAT_ID,
        text: `API|${url}|${ep}`
      })
    });

    // 🔥 2. ESPERAR RESPUESTA
    await new Promise(r => setTimeout(r, 2000));

    // 🔥 3. LEER RESPUESTA
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates`);
    const data = await res.json();

    const last = data.result?.pop();
    const text = last?.message?.text || "";

    if (text.startsWith("OK|")) {
      const parts = text.split("|");
      return parts[2];
    }

    return null;

  } catch {
    return null;
  }
}

export default defineEventHandler(async (event) => {
  try {

    const query = getQuery(event);
    const { url, ep, slug } = query;

    const episodeNumber = parseInt(ep as string, 10);
    const baseUrl = decodeURIComponent(url as string);

    console.log(`🎬 ${baseUrl} EP ${episodeNumber}`);

    // =====================
    // 🔥 CACHE
    // =====================
    let cacheKey = await generateCacheKey(baseUrl, episodeNumber);
    const env = event.context.cloudflare?.env;

    if (env?.ANIME_CACHE) {
      const cached = await env.ANIME_CACHE.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    // =====================
    // 🔥 SEEKE
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

    console.log("❌ SEEKE FALLÓ");

    // =====================
    // 🔥 TELEGRAM BOT
    // =====================
    const botVideo = await telegramRequest(baseUrl, episodeNumber);

    if (botVideo) {
      console.log("🤖 BOT OK");

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

    console.log("❌ BOT FALLÓ");

    // =====================
    // 🔥 FALLBACK
    // =====================
    if (slug) {
      const servers = await getAllServers({
        slug,
        number: episodeNumber,
        title: slug,
        env
      });

      if (servers?.length) {
        return {
          ok: true,
          episode: episodeNumber,
          embed: servers[0].embed,
          source: "fallback"
        };
      }
    }

    return {
      ok: false,
      error: "No se pudo obtener el episodio"
    };

  } catch (err) {
    return {
      ok: false,
      error: "Server error"
    };
  }
});
