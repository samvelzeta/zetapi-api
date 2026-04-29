import { scrapeSeekeEpisode, generateCacheKey } from '../../utils/seekeScraper';
import { getAllServers } from '../../utils/getServers';

const BOT_URL = "https://ferrari-exploring-bulk-win.trycloudflare.com";

export default defineEventHandler(async (event) => {
  try {

    const query = getQuery(event);
    const { url, ep, slug } = query;

    if (!url || !ep) {
      return { ok: false, error: "missing params" };
    }

    const episodeNumber = parseInt(ep as string, 10);
    const baseUrl = decodeURIComponent(url as string);

    console.log(`🎬 ${baseUrl} EP ${episodeNumber}`);

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
    // BOT LOCAL (CON TIMEOUT)
    // =====================
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s

    let botRes;

    try {
      botRes = await fetch(BOT_URL, {
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
    } catch (e) {
      console.log("❌ BOT NO RESPONDE");
      botRes = null;
    }

    clearTimeout(timeout);

    if (botRes && botRes.ok) {
      const data = await botRes.json();

      if (data.ok && data.embed) {

        console.log("🤖 BOT OK");

        if (env?.ANIME_CACHE) {
          await env.ANIME_CACHE.put(cacheKey, JSON.stringify(data));
        }

        return data;
      }
    }

    console.log("❌ BOT FALLÓ → fallback");

    // =====================
    // FALLBACK
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

    return { ok: false, error: "no sources" };

  } catch (err) {
    console.log("💥 ERROR GLOBAL", err);
    return { ok: false, error: "server error" };
  }
});
