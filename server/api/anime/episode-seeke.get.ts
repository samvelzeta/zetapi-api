import { scrapeSeekeEpisode, generateCacheKey } from '../../../utils/seekeScraper';
import { getAllServers } from '../../../utils/getServers';

const TELEGRAM_TOKEN = "8767809201:AAHhCa63uxL5yIMolv5CxMsgdgrPQOBuJgY";
const CHAT_ID = "-1003993096263"; // 👈 TU GRUPO

// ==============================
// 🔥 LIMPIAR URL
// ==============================
function cleanUrl(url: string) {
  return url.split("|")[0];
}

// ==============================
// 🔥 TELEGRAM REQUEST (UNA SOLA VEZ)
// ==============================
async function telegramRequest(url: string, ep: number): Promise<string | null> {
  try {

    const clean = cleanUrl(url);

    // 🔥 1. ENVIAR SOLO UNA VEZ
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        chat_id: CHAT_ID,
        text: `API|${clean}|${ep}`
      })
    });

    // 🔥 2. ESPERAR RESPUESTA (REINTENTO CONTROLADO)
    for (let i = 0; i < 6; i++) {

      await new Promise(r => setTimeout(r, 1500));

      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates`);
      const data = await res.json();

      if (!data.result?.length) continue;

      // 🔥 3. BUSCAR SOLO RESPUESTAS OK DEL MISMO EP
      for (let j = data.result.length - 1; j >= 0; j--) {

        const text = data.result[j]?.message?.text || "";

        if (!text.startsWith("OK|")) continue;

        const parts = text.split("|");

        if (parts.length < 3) continue;

        const msgEp = parseInt(parts[1], 10);
        const video = parts[2];

        // 🔥 VALIDACIÓN REAL
        if (msgEp === ep && video.includes(".m3u8")) {
          return video;
        }
      }
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
      return { ok: false, error: "Missing params" };
    }

    const episodeNumber = parseInt(ep as string, 10);
    const baseUrl = decodeURIComponent(url as string);

    console.log(`🎬 Solicitud: ${baseUrl} EP ${episodeNumber}`);

    const env = event.context.cloudflare?.env || (globalThis as any);

    // =====================
    // 🔥 CACHE
    // =====================
    const cacheKey = await generateCacheKey(baseUrl, episodeNumber);

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
    // 🤖 TELEGRAM BOT (FIX REAL)
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
    console.error(err);
    return {
      ok: false,
      error: "Server error"
    };
  }
});
