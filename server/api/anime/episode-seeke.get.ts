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
    const { url, ep, slug } = query;

    if (!url || !ep) {
      return { ok: false, error: "missing params" };
    }

    const episodeNumber = parseInt(ep as string, 10);
    const baseUrl = cleanUrl(url as string);

    // 🔥 BOT VPS
    const BOT_URL = "https://a24785-ef25.xs001.jrnm.app/extraer";

    let responseData: any = null;

    // =========================
    // 1. BOT VPS (PRIORIDAD)
    // =========================
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

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

        console.log("📦 BOT RESPONSE:", data);

        if (data && data.ok && isValidVideo(data.embed)) {

          // 🔥 ARREGLO CLAVE (subtitles vs subtitulos)
          const subs = data.subtitles || data.subtitulos || [];

          responseData = {
            ok: true,
            episode: episodeNumber,
            embed: data.embed,
            subtitles: subs,
            type: subs.length ? "softsubs" : "hardsubs",
            source: "vps_bot"
          };
        }
      }

    } catch (e) {
      console.log("⚠️ BOT ERROR:", e);
    }

    // =========================
    // 2. FALLBACK
    // =========================
    if (!responseData && slug) {
      try {
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
      } catch (e) {
        console.log("⚠️ FALLBACK ERROR:", e);
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
