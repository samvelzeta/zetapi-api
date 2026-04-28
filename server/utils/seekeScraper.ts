import { fetchHtml } from "./fetcher";

interface SeekeScrapeResult {
  episode: number;
  embed: string;
  url: string;
  status: 'success' | 'failed';
  error?: string;
}

// ==============================
// 🔥 EXTRAER M3U8 (MEJORADO)
// ==============================
function extractM3U8(html: string): string | null {

  const matches = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);

  if (!matches || !matches.length) return null;

  return matches[0];
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
    html = await fetchHtml(episodeUrl);

    // ==============================
    // 🔁 2. RETRY DESKTOP
    // ==============================
    if (!html) {
      console.log("🔁 Retry desktop");

      const res = await fetch(episodeUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          "Accept": "*/*",
          "Referer": baseUrl,
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
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
          "Accept": "*/*",
          "Referer": baseUrl,
        },
        redirect: "follow"
      });

      if (res.ok) {
        html = await res.text();
      }
    }

    // ==============================
    // ❌ BLOQUEADO
    // ==============================
    if (!html || html.length < 300) {
      return {
        episode: episodeNumber,
        embed: "",
        url: episodeUrl,
        status: "failed",
        error: "403 o vacío"
      };
    }

    // ==============================
    // 🔥 EXTRAER VIDEO
    // ==============================
    const m3u8 = extractM3U8(html);

    if (!m3u8) {
      return {
        episode: episodeNumber,
        embed: "",
        url: episodeUrl,
        status: "failed",
        error: "No m3u8 encontrado"
      };
    }

    console.log("🎬 M3U8:", m3u8);

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
// 🔥 CACHE KEY
// ==============================
export async function generateCacheKey(
  baseUrl: string,
  episode: number
): Promise<string> {

  const hash = btoa(baseUrl).slice(0, 12);
  return `seeke:${hash}:${episode}`;
}
