import { getAllServers } from '../../utils/getServers';

function cleanUrl(input: string) {
  if (!input) return "";
  let clean = decodeURIComponent(input);
  clean = clean.split('|')[0].trim();
  clean = clean.replace(/\/+$/, "");
  return clean;
}

function isValidVideo(url: string) {
  return typeof url === "string" && url.includes(".m3u8");
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { url, ep, slug, lang = 'lat' } = query;

    if (!url || !ep) {
      return { ok: false, error: "missing params" };
    }

    const episodeNumber = parseInt(ep as string, 10);
    const baseUrl = cleanUrl(url as string);

    // 🔥 TU BOT REAL (CORRECTO)
    const BOT_URL = "https://a23755-9810.e.jrnm.app";

    let responseData: any = null;

    // =========================
    // 1. BOT VPS (PRIORIDAD TOTAL)
    // =========================
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // ⚡ más rápido

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

      clearTimeout(timeoutId);

      if (botRes.ok) {
        const data = await botRes.json();

        if (data && data.ok && isValidVideo(data.embed)) {
          responseData = {
            ok: true,
            episode: episodeNumber,
            embed: data.embed,
            subtitles: data.subtitles || [],
            type: data.subtitles?.length ? "softsubs" : "hardsubs",
            source: "vps_bot"
          };
        }
      }

    } catch (e) {
      console.log("⚠️ BOT ERROR:", e);
    }

    // =========================
    // 2. FALLBACK (SI FALLA TODO)
    // =========================
    if (!responseData && slug) {
      const servers = await getAllServers({
        slug: slug as string,
        number: episodeNumber,
        title: slug as string,
        env: event.context.cloudflare?.env
      });

      if (servers?.length && isValidVideo(servers[0].embed)) {
        return {
          ok: true,
          episode: episodeNumber,
          embed: servers[0].embed,
          subtitles: [],
          type: "hardsubs",
          source: "fallback"
        };
      }
    }

    // =========================
    // 3. RESPUESTA FINAL
    // =========================
    if (responseData) {
      return responseData;
    }

    return { ok: false };

  } catch (err: any) {
    console.error("💥 ERROR:", err.message);
    return { ok: false };
  }
});
