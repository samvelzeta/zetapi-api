// server/utils/seekeScraper.ts

import { fetchHtml } from "./fetcher";

// ==============================
// 🔥 GENERADOR DE KEY KV (OPCIONAL)
// ==============================
export function generateCacheKey(url: string, ep: number) {
  return `seeke:${url}:${ep}`;
}

// ==============================
// 🔥 SCRAPER PRINCIPAL
// ==============================
export async function scrapeSeekeEpisode(baseUrl: string, episodeNumber: number) {

  const episodeUrl = `${baseUrl}/${episodeNumber}`;

  console.log("🔍 SEEKE URL:", episodeUrl);

  try {

    let html: string | null = null;

    // ==============================
    // 🔥 1. INTENTO CON TU FETCHER PRO
    // ==============================
    try {
      html = await fetchHtml(episodeUrl);
      console.log("🌐 fetchHtml usado");
    } catch (e) {
      console.log("⚠️ fetchHtml falló");
    }

    // ==============================
    // 🔁 2. RETRY DESKTOP
    // ==============================
    if (!html) {
      console.log("🔁 Retry desktop");

      const res = await fetch(episodeUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9",
          "Referer": baseUrl,
          "Connection": "keep-alive"
        },
        redirect: "follow"
      });

      if (res.ok) {
        html = await res.text();
      }
    }

    // ==============================
    // 🔁 3. RETRY MOBILE
    // ==============================
    if (!html) {
      console.log("🔁 Retry mobile");

      const res = await fetch(episodeUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
          "Accept": "*/*",
          "Referer": baseUrl
        },
        redirect: "follow"
      });

      if (res.ok) {
        html = await res.text();
      }
    }

    // ==============================
    // ❌ SI TODO FALLA
    // ==============================
    if (!html || html.length < 200) {
      console.log("❌ HTML vacío o bloqueado");

      return {
        episode: episodeNumber,
        embed: "",
        url: episodeUrl,
        status: "failed",
        error: "403 o respuesta vacía"
      };
    }

    // ==============================
    // 🔥 EXTRAER TODOS LOS M3U8
    // ==============================
    const matches = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g) || [];

    if (!matches.length) {
      console.log("❌ No se encontró m3u8");

      return {
        episode: episodeNumber,
        embed: "",
        url: episodeUrl,
        status: "failed",
        error: "No m3u8 encontrado"
      };
    }

    const video = matches[0];

    console.log("🎬 VIDEO ENCONTRADO:", video);

    return {
      episode: episodeNumber,
      embed: video,
      url: episodeUrl,
      status: "success"
    };

  } catch (error) {

    console.log("❌ ERROR SEEKE:", error);

    return {
      episode: episodeNumber,
      embed: "",
      url: episodeUrl,
      status: "failed",
      error: String(error)
    };
  }
}
