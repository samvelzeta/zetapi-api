import { fetchHtml } from "./fetcher";

interface SeekeScrapeResult {
  episode: number;
  embed: string;
  url: string;
  status: "success" | "failed";
  error?: string;
}

// ==============================
// 🔥 USER AGENTS
// ==============================
function getRandomUserAgent(): string {
  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1"
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

// ==============================
// 🔥 HEADERS
// ==============================
function getHeaders(baseUrl: string): HeadersInit {
  const origin = new URL(baseUrl).origin;

  return {
    "User-Agent": getRandomUserAgent(),
    "Accept": "*/*",
    "Referer": origin,
    "Origin": origin,
    "Connection": "keep-alive"
  };
}

// ==============================
// 🔥 EXTRACTORES (MULTI MÉTODO)
// ==============================
function extractM3U8(html: string): string | null {

  const methods = [
    /https?:\/\/[^"' ]+\.m3u8[^"' ]*/i,
    /src\s*=\s*["']?(https?[^"'<>\s]*\.m3u8)/i,
    /["']?(https?[^"'<>\s]*\.m3u8)[^"'<>\s]*["']?/i
  ];

  for (const regex of methods) {
    const match = html.match(regex);
    if (match) {
      const clean = match[0].split(/[\?#"'<>]/)[0];
      return clean;
    }
  }

  return null;
}

// ==============================
// 🔥 VALIDAR M3U8
// ==============================
async function validateM3U8(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": getRandomUserAgent()
      }
    });

    return res.ok;
  } catch {
    return false;
  }
}

// ==============================
// 🔥 SCRAPER PRINCIPAL
// ==============================
export async function scrapeSeekeEpisode(
  baseUrl: string,
  episodeNumber: number
): Promise<SeekeScrapeResult> {

  const episodeUrl = `${baseUrl}/${episodeNumber}`;
  console.log(`🔍 SEEKE: ${episodeUrl}`);

  try {

    let html: string | null = null;

    // ==============================
    // 🔥 1. FETCHER PRO (TUYO)
    // ==============================
    try {
      html = await fetchHtml(episodeUrl);
      console.log("🌐 fetchHtml OK");
    } catch {
      console.log("⚠️ fetchHtml falló");
    }

    // ==============================
    // 🔁 2. RETRY DESKTOP
    // ==============================
    if (!html) {
      console.log("🔁 Retry desktop");

      const res = await fetch(episodeUrl, {
        headers: getHeaders(baseUrl),
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
        headers: {
          "User-Agent": getRandomUserAgent(),
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
    // ❌ BLOQUEO
    // ==============================
    if (!html || html.length < 300) {
      return {
        episode: episodeNumber,
        embed: "",
        url: episodeUrl,
        status: "failed",
        error: "403 o HTML vacío"
      };
    }

    // ==============================
    // 🔥 EXTRAER M3U8
    // ==============================
    const m3u8 = extractM3U8(html);

    if (!m3u8) {
      return {
        episode: episodeNumber,
        embed: "",
        url: episodeUrl,
        status: "failed",
        error: "No se encontró m3u8"
      };
    }

    // ==============================
    // 🔥 VALIDAR VIDEO
    // ==============================
    const valid = await validateM3U8(m3u8);

    if (!valid) {
      return {
        episode: episodeNumber,
        embed: "",
        url: episodeUrl,
        status: "failed",
        error: "m3u8 inválido"
      };
    }

    console.log("🎬 VIDEO OK:", m3u8);

    return {
      episode: episodeNumber,
      embed: m3u8,
      url: episodeUrl,
      status: "success"
    };

  } catch (err) {

    return {
      episode: episodeNumber,
      embed: "",
      url: episodeUrl,
      status: "failed",
      error: String(err)
    };
  }
}

// ==============================
// 🔥 CACHE KEY (IMPORTANTE)
// ==============================
export async function generateCacheKey(
  baseUrl: string,
  episode: number
): Promise<string> {

  const hash = btoa(baseUrl).slice(0, 12);

  // 🔥 version nueva → evita cache corrupto
  return `seeke:v2:${hash}:${episode}`;
}
