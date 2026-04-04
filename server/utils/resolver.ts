import { $fetch } from "ofetch";
import { detectServerType, isValidVideo } from "./serverTypes";

// ==============================
// ðŸ”¥ HEADERS REALISTAS
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
// ðŸ”¥ EXTRAER VIDEO DEL HTML
// ==============================
function extractVideo(html: string): string | null {

  if (!html) return null;

  // ðŸ”¥ m3u8 directo
  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  if (m3u8?.length) return m3u8[0];

  // ðŸ”¥ mp4 directo
  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  if (mp4?.length) return mp4[0];

  // ðŸ”¥ jwplayer file:
  const file = html.match(/file\s*:\s*"([^"]+)"/);
  if (file?.[1]) return file[1];

  // ðŸ”¥ sources array
  const sources = html.match(/sources\s*:\s*\[\{file:\s*"([^"]+)"/);
  if (sources?.[1]) return sources[1];

  // ðŸ”¥ eval packed (simple)
  const packed = html.match(/eval\(function\(p,a,c,k,e,d\).*?\)\)/s);
  if (packed) {
    try {
      const unpacked = eval(packed[0]);
      return extractVideo(unpacked);
    } catch {}
  }

  return null;
}

// ==============================
// ðŸ”¥ FETCH HTML SEGURO
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
// ðŸ”¥ RESOLVER GENERICO
// ==============================
async function resolveGeneric(url: string): Promise<string | null> {

  const html = await fetchHtml(url);
  if (!html) return null;

  const video = extractVideo(html);

  if (isValidVideo(video)) return video;

  return null;
}

// ==============================
// ðŸ”¥ STREAMWISH
// ==============================
async function resolveStreamwish(url: string) {
  return await resolveGeneric(url);
}

// ==============================
// ðŸ”¥ DOOD
// ==============================
async function resolveDood(url: string) {
  return await resolveGeneric(url);
}

// ==============================
// ðŸ”¥ FILEMOON
// ==============================
async function resolveFilemoon(url: string) {
  return await resolveGeneric(url);
}

// ==============================
// ðŸ”¥ STREAMTAPE
// ==============================
async function resolveStreamtape(url: string) {
  return await resolveGeneric(url);
}

// ==============================
// ðŸ”¥ MAIN RESOLVER
// ==============================
export async function resolveServer(url: string): Promise<string | null> {

  if (!url) return null;

  const type = detectServerType(url);

  // ==========================
  // ðŸ”¥ DIRECTOS
  // ==========================
  if (type === "hls" || type === "mp4") {
    return url;
  }

  try {

    switch (type) {

      case "streamwish":
        return await resolveStreamwish(url);

      case "dood":
        return await resolveDood(url);

      case "filemoon":
        return await resolveFilemoon(url);

      case "streamtape":
        return await resolveStreamtape(url);

      default:
        return await resolveGeneric(url);
    }

  } catch {
    return null;
  }
}
