import { scrapeSeekeEpisode } from '../../utils/seekeScraper';
import { getAllServers } from '../../utils/getServers';

const BOT_URL = "https://due-arabia-recipient-genome.trycloudflare.com"; // 👈 CAMBIAR

function cleanUrl(input: string) {
  let clean = decodeURIComponent(input);
  clean = clean.replace(/\/\d+$/, "");
  return clean;
}

function generateSafeKey(url: string, ep: number) {
  const base = url
    .replace(/^https?:\/\//, "")
    .replace(/[^\w]/g, "_");

  return `${base}_${ep}`;
}

function isValidVideo(url: string) {
  return typeof url === "string" && url.includes(".m3u8");
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

    console.log("🎬", baseUrl, episodeNumber);

    const env = event.context.cloudflare?.env || (globalThis as any);
    const cacheKey = generateSafeKey(baseUrl, episodeNumber);

    // CACHE
    if (env?.ANIME_CACHE) {
      const cached = await env.ANIME_CACHE.get(cacheKey);

      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.embed && isValidVideo(parsed.embed)) {
          console.log("⚡ CACHE HIT");
          return parsed;
        }
      }
    }

    // SEEKE
    const seeke = await scrapeSeekeEpisode(baseUrl, episodeNumber);

    if (seeke.status === "success" && isValidVideo(seeke.embed)) {

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

    console.log("❌ SEEKE FALLÓ → BOT");

    // BOT
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
        })
      });

      const text = await botRes.text();
      console.log("📦 BOT:", text);

      try {
        data = JSON.parse(text);
      } catch {}
    } catch (e) {
      console.log("❌ BOT ERROR", e);
    }

    if (data && isValidVideo(data.embed)) {

      const res = {
        ok: true,
        episode: episodeNumber,
        embed: data.embed,
        source: "bot"
      };

      if (env?.ANIME_CACHE) {
        await env.ANIME_CACHE.put(cacheKey, JSON.stringify(res));
      }

      return res;
    }

    console.log("❌ BOT FALLÓ → FALLBACK");

    // FALLBACK
    if (slug) {
      const servers = await getAllServers({
        slug,
        number: episodeNumber,
        title: slug,
        env
      });

      if (servers?.length && isValidVideo(servers[0].embed)) {
        return {
          ok: true,
          episode: episodeNumber,
          embed: servers[0].embed,
          source: "fallback"
        };
      }
    }

    return { ok: false };

  } catch (err) {
    console.log("💥 ERROR", err);
    return { ok: false };
  }
});
