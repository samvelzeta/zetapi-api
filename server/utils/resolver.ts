import { $fetch } from "ofetch";
import { detectServerType, isValidVideo } from "./serverTypes";

// ==============================
// 🔥 HEADERS REALISTAS (NO TOCAR)
// ==============================
function getHeaders(url: string) {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": new URL(url).origin,
    "Origin": new URL(url).origin
  };
}

// ==============================
// 🔥 VALIDAR HLS REAL (🔥 CLAVE)
// ==============================
async function validateHLS(url: string): Promise<boolean> {
  try {
    const res = await $fetch(url, {
      headers: getHeaders(url)
    });

    const text = typeof res === "string" ? res : JSON.stringify(res);

    // 🔥 contar segmentos reales
    const segments = text.match(/\.ts/g);

    // mínimo ~3 minutos aprox
    if (!segments || segments.length < 25) {
      return false;
    }

    return true;

  } catch {
    return false;
  }
}

// ==============================
// 🔥 EXTRAER VIDEO
// ==============================
function extractVideo(html: string): string | null {

  if (!html) return null;

  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  if (m3u8?.length) return m3u8[0];

  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  if (mp4?.length) return mp4[0];

  const file = html.match(/file\s*:\s*"([^"]+)"/);
  if (file?.[1]) return file[1];

  return null;
}

// ==============================
// 🔥 FETCH HTML
// ==============================
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await $fetch(url, {
      headers: getHeaders(url)
    });

    return typeof res === "string" ? res : JSON.stringify(res);
  } catch {
    return null;
  }
}

// ==============================
// 🔥 RESOLVER GENERICO
// ==============================
async function resolveGeneric(url: string): Promise<string | null> {

  const html = await fetchHtml(url);
  if (!html) return null;

  const video = extractVideo(html);

  if (!video) return null;

  // 🔥 VALIDAR HLS
  if (video.includes(".m3u8")) {
    const valid = await validateHLS(video);
    if (!valid) return null;
  }

  if (isValidVideo(video)) return video;

  return null;
}

// ==============================
// 🔥 MAIN RESOLVER
// ==============================
export async function resolveServer(url: string): Promise<string | null> {

  if (!url) return null;

  const type = detectServerType(url);

  // 🔥 DIRECTOS
  if (type === "hls") {
    const valid = await validateHLS(url);
    return valid ? url : null;
  }

  if (type === "mp4") return url;

  try {

    switch (type) {

      case "streamwish":
      case "dood":
      case "filemoon":
      case "streamtape":
        return await resolveGeneric(url);

      default:
        return await resolveGeneric(url);
    }

  } catch {
    return null;
  }
}
