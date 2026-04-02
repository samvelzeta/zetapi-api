import { $fetch } from "ofetch";
import { detectServerType, isValidVideo } from "./serverTypes";

// ==============================
// 🔥 HEADERS
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
async function isValidHLS(url: string): Promise<boolean> {
  try {
    const res = await $fetch(url);
    const text = typeof res === "string" ? res : JSON.stringify(res);

    const segments = text.match(/\.ts/g);

    // mínimo segmentos reales (~3+ min)
    if (!segments || segments.length < 20) return false;

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

  const multi = html.match(/file:\s*"([^"]+\.m3u8[^"]*)"/);
  if (multi?.[1]) return multi[1];

  const alt = html.match(/src:\s*"([^"]+\.m3u8[^"]*)"/);
  if (alt?.[1]) return alt[1];

  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  if (m3u8?.length) return m3u8[0];

  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  if (mp4?.length) return mp4[0];

  const file = html.match(/file\s*:\s*"([^"]+)"/);
  if (file?.[1]) return file[1];

  return null;
}

// ==============================
// 🔥 FETCH
// ==============================
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await $fetch(url, { headers: getHeaders(url) });
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

  if (isValidVideo(video)) return video;

  return null;
}

// ==============================
// 🔥 MAIN
// ==============================
export async function resolveServer(url: string): Promise<string | null> {

  if (!url) return null;

  const type = detectServerType(url);

  // 🔥 HLS VALIDADO
  if (type === "hls") {
    const valid = await isValidHLS(url);
    return valid ? url : null;
  }

  if (type === "mp4") return url;

  try {
    return await resolveGeneric(url);
  } catch {
    return null;
  }
}
