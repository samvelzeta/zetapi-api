import { scrapeSeekeEpisode, generateCacheKey } from '../../utils/seekeScraper';
import { getAllServers } from '../../utils/getServers';

const BOT_URL = "https://porter-stops-households-events.trycloudflare.com";

// ==============================
// 🔥 LIMPIAR URL (FIX CRÍTICO)
// ==============================
function cleanUrl(input: string) {
  let clean = decodeURIComponent(input);

  // elimina /numero al final (ej: /5)
  clean = clean.replace(/\/\d+$/, "");

  return clean;
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

    console.log(`🎬 REQUEST: ${baseUrl} EP ${episodeNumber}`);

    const env = event.context.cloudflare?.env || (globalThis as any);

    // =====================
    // CACHE
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
    // SEEKE
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

    console.log("❌ SEEKE FALLÓ → usando bot");

    // =====================
    // 🤖 BOT LOCAL (ROBUSTO)
    // =====================
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let data: any = null;

    try {
      const botRes = await fetch(BOT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: baseUrl,
          ep: episodeNumber
        }),
        signal: controller.signal
      });

      console.log("📡 BOT STATUS:", botRes.status);

      const text = await botRes.text();
      console.log("📦 BOT RAW:", text);

      try {
        data = JSON.parse(text);
      } catch {
        console.log("❌ JSON inválido del bot");
      }

    } catch (e) {
      console.log("❌ BOT ERROR:", e);
    }

    clearTimeout(timeout);

    if (data && data.embed) {

      console.log("🤖 BOT OK");

      if (env?.ANIME_CACHE) {
        await env.ANIME_CACHE.put(cacheKey, JSON.stringify(data));
      }

      return data;
    }

    console.log("❌ BOT FALLÓ → fallback");

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
      error: "no sources",
      debug: {
        url: baseUrl,
        ep: episodeNumber
      }
    };

  } catch (err) {
    console.log("💥 ERROR GLOBAL", err);

    return {
      ok: false,
      error: "server error"
    };
  }
});
