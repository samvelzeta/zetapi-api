import { detectServerType, isValidVideo } from "./serverTypes";

// ==============================
// 🔥 HEADERS PRO (ANTI BLOQUEO REAL)
// ==============================
function getHeaders(url: string) {
  const origin = new URL(url).origin;

  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
    "Referer": origin,
    "Origin": origin
  };
}

// ==============================
// 🔥 FETCH HTML REALISTA
// ==============================
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: getHeaders(url)
    });

    const text = await res.text();

    if (!text || text.length < 200) return null;

    return text;
  } catch {
    return null;
  }
}

// ==============================
// 🔥 EXTRAER VIDEO REAL
// ==============================
function extractVideo(html: string): string | null {

  if (!html) return null;

  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/);
  if (m3u8?.[0]) return m3u8[0];

  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/);
  if (mp4?.[0]) return mp4[0];

  const file = html.match(/file\s*:\s*"([^"]+)"/);
  if (file?.[1]) return file[1];

  const sources = html.match(/sources\s*:\s*\[\{file:\s*"([^"]+)"/);
  if (sources?.[1]) return sources[1];

  return null;
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

  // 🔥 directos
  if (type === "hls" || type === "mp4") return url;

  try {
    return await resolveGeneric(url);
  } catch {
    return null;
  }
}
