import { scrapeSeekeEpisode, generateCacheKey } from '../../../utils/seekeScraper';
import { getAllServers } from '../../../utils/getServers';

let LAST_UPDATE_ID = 0;

const TELEGRAM_TOKEN = "8767809201:AAHhCa63uxL5yIMolv5CxMsgdgrPQOBuJgY";
const CHAT_ID = "1749255245";

// ==============================
// 🔥 TELEGRAM REQUEST (CORRECTO)
// ==============================
async function telegramRequest(url: string, ep: number): Promise<string | null> {
  try {

    // 🔥 enviar comando al bot
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        chat_id: CHAT_ID,
        text: `API|${url}|${ep}`
      })
    });

    // 🔥 esperar respuesta real
    await new Promise(r => setTimeout(r, 2000));

    // 🔥 leer SOLO mensajes nuevos
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${LAST_UPDATE_ID + 1}`
    );

    const data = await res.json();

    if (!data.result?.length) return null;

    const last = data.result[data.result.length - 1];

    LAST_UPDATE_ID = last.update_id;

    const text = last.message?.text || "";

    if (text.startsWith("OK|")) {
      return text.split("|")[2];
    }

    return null;

  } catch (e) {
    console.log("❌ TELEGRAM ERROR:", e);
    return null;
  }
}

// ==============================
// 🔥 MAIN HANDLER
// ==============================
export default defineEventHandler(async (event) => {
  try {

    const query = getQuery(event);
    const { url, ep, slug } = query;

    if (!url || !ep) {
      return {
        ok: false,
        error: "Missing params"
      };
    }

    const episodeNumber = parseInt(ep as string, 10);
    const baseUrl = decodeURIComponent(url as string);

    console.log(`🎬 ${baseUrl} EP ${episodeNumber}`);

    // =====================
    // 🔥 CACHE KV
    // =====================
    const cacheKey = await generateCacheKey(baseUrl, episodeNumber);
    const env = event.context.cloudflare?.env || (globalThis as any);

    if (env?.ANIME_CACHE) {
      const cached = await env.ANIME_CACHE.get(cacheKey);
      if (cached) {
        console.log("⚡ CACHE HIT");
        return JSON.parse(cached);
      }
    }

    // =====================
    // 🔥 SEEKE
    // =====================
    const seeke = await scrapeSeekeEpisode(baseUrl, episodeNumber);

    if (seeke.status === "success" && seeke.embed) {

      console.log("✅ SEEKE OK");

      const res = {
        ok: true,
        episode: episodeNumber,
        embed: seeke.embed,
        source: "seeke"
      };

      if (env?.ANIME_CACHE) {
        await env.ANIME_CACHE.put(cacheKey, JSON.stringify(res));
      }

      return res;
    }

    console.log("❌ SEEKE FALLÓ");

    // =====================
    // 🤖 TELEGRAM BOT
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
