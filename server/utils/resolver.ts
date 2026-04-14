import { detectServerType, normalizeUrl } from "./serverTypes";

// ==============================
// 🔥 HEADERS PRO (ANTI BLOQUEO REAL)
// ==============================
function getHeaders(url: string) {

  const origin = new URL(url).origin;

  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/118 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36"
  ];

  const ua = agents[Math.floor(Math.random() * agents.length)];

  return {
    "User-Agent": ua,
    "Accept": "*/*",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Connection": "keep-alive",
    "Referer": origin,
    "Origin": origin
  };
}

// ==============================
// 🔥 FETCH HTML ROBUSTO
// ==============================
async function fetchHtml(url: string): Promise<string | null> {

  try {

    const res = await fetch(url, {
      headers: getHeaders(url)
    });

    if (!res.ok) return null;

    const text = await res.text();

    if (!text || text.length < 200) return null;

    return text;

  } catch {
    return null;
  }
}

// ==============================
// 🔥 EXTRAER HLS PROFUNDO (LOGICA PYTHON)
// ==============================
function extractHLSDeep(html: string): string[] {

  const results = new Set<string>();

  if (!html) return [];

  // 🔥 directos
  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  m3u8?.forEach(u => results.add(u));

  // 🔥 file: "..."
  const file = html.match(/file\s*:\s*"([^"]+)"/g);
  file?.forEach(f => {
    const url = f.match(/"([^"]+)"/)?.[1];
    if (url && url.includes(".m3u8")) results.add(url);
  });

  // 🔥 sources: [...]
  const sources = html.match(/sources\s*:\s*\[[^\]]+\]/g);
  sources?.forEach(block => {
    const urls = block.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
    urls?.forEach(u => results.add(u));
  });

  // 🔥 JSON interno
  const json = html.match(/https?:\/\/[^"' ]+\/playlist[^"' ]+\.m3u8[^"' ]*/g);
  json?.forEach(u => results.add(u));

  return Array.from(results);
}

// ==============================
// 🔥 EXTRAER MP4 (FALLBACK)
// ==============================
function extractMP4(html: string): string[] {

  const results = new Set<string>();

  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  mp4?.forEach(u => results.add(u));

  return Array.from(results);
}

// ==============================
// 🔥 RESOLVER GENERICO (MEJORADO)
// ==============================
async function resolveGeneric(url: string): Promise<string | null> {

  const html = await fetchHtml(url);
  if (!html) return null;

  const hls = extractHLSDeep(html);
  if (hls.length) return hls[0];

  const mp4 = extractMP4(html);
  if (mp4.length) return mp4[0];

  return null;
}

// ==============================
// 🔥 RESOLVER STREAMWISH
// ==============================
async function resolveStreamwish(url: string): Promise<string | null> {

  const html = await fetchHtml(url);
  if (!html) return null;

  const hls = extractHLSDeep(html);
  if (hls.length) return hls[0];

  return null;
}

// ==============================
// 🔥 RESOLVER FILEMOON
// ==============================
async function resolveFilemoon(url: string): Promise<string | null> {

  const html = await fetchHtml(url);
  if (!html) return null;

  const hls = extractHLSDeep(html);
  if (hls.length) return hls[0];

  return null;
}

// ==============================
// 🔥 RESOLVER DOOD
// ==============================
async function resolveDood(url: string): Promise<string | null> {

  const html = await fetchHtml(url);
  if (!html) return null;

  const hls = extractHLSDeep(html);
  if (hls.length) return hls[0];

  return null;
}

// ==============================
// 🔥 RESOLVER PRINCIPAL
// ==============================
export async function resolveServer(rawUrl: string): Promise<string | null> {

  try {

    const url = normalizeUrl(rawUrl);
    if (!url) return null;

    // 🔥 DIRECTO
    if (url.includes(".m3u8") || url.includes(".mp4")) {
      return url;
    }

    const type = detectServerType(url);

    // ==========================
    // 🔥 SWITCH POR SERVER
    // ==========================
    switch (type) {

      case "streamwish":
        return await resolveStreamwish(url);

      case "filemoon":
        return await resolveFilemoon(url);

      case "dood":
        return await resolveDood(url);

      default:
        return await resolveGeneric(url);
    }

  } catch {
    return null;
  }
}
