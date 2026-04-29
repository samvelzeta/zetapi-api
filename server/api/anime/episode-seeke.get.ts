import { scrapeSeekeEpisode, generateCacheKey } from '../../utils/seekeScraper';
import { getAllServers } from '../../utils/getServers';

const BOT_URL = "https://ferrari-exploring-bulk-win.trycloudflare.com"; // 🔥 AQUÍ

export default defineEventHandler(async (event) => {
  try {

    const query = getQuery(event);
    const { url, ep, slug } = query;

    if (!url || !ep) {
      return { ok: false };
    }

    const episodeNumber = parseInt(ep as string, 10);
    const baseUrl = decodeURIComponent(url as string);

    const env = event.context.cloudflare?.env || (globalThis as any);

    // =====================
    // CACHE
    // =====================
    const cacheKey = await generateCacheKey(baseUrl, episodeNumber);

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
    // 🔥 BOT LOCAL (NUEVO)
    // =====================
    const botRes = await fetch(`${BOT_URL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: baseUrl,
        ep: episodeNumber
      })
    });

    if (botRes.ok) {
      const data = await botRes.json();

      if (data.ok && data.embed) {

        if (env?.ANIME_CACHE) {
          await env.ANIME_CACHE.put(cacheKey, JSON.stringify(data));
        }

        return data;
      }
    }

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

    return { ok: false };

  } catch {
    return { ok: false };
  }
});
