import { detectServerType, normalizeUrl } from "./serverTypes";

// ==============================
// 🔥 HEADERS PRO
// ==============================
function getHeaders(url: string) {

  const origin = new URL(url).origin;

  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Mozilla/5.0 (X11; Linux x86_64)",
    "Mozilla/5.0 (Linux; Android 10)"
  ];

  const ua = agents[Math.floor(Math.random() * agents.length)];

  return {
    "User-Agent": ua,
    "Referer": origin,
    "Origin": origin
  };
}

// ==============================
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: getHeaders(url)
    });

    if (!res.ok) return null;

    return await res.text();

  } catch {
    return null;
  }
}

// ==============================
// 🔥 EXTRAER HLS
// ==============================
function extractHLSDeep(html: string): string[] {

  const results = new Set<string>();

  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  m3u8?.forEach(u => results.add(u));

  const file = html.match(/file\s*:\s*"([^"]+)"/g);
  file?.forEach(f => {
    const url = f.match(/"([^"]+)"/)?.[1];
    if (url?.includes(".m3u8")) results.add(url);
  });

  return Array.from(results);
}

// ==============================
// 🔥 RESOLVER ZILLA (🔥 CLAVE)
// ==============================
function resolveZilla(url: string): string | null {

  const match = url.match(/play\/([a-z0-9]+)/i);

  if (!match) return null;

  const id = match[1];

  return `https://cdn.zilla-networks.com/hls/${id}/master.m3u8`;
}

// ==============================
// 🔥 GENERIC
// ==============================
async function resolveGeneric(url: string): Promise<string | null> {

  // 🔥 ZILLA DETECTADO
  if (url.includes("zilla-networks")) {
    const zilla = resolveZilla(url);
    if (zilla) return zilla;
  }

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

    switch (type) {

      case "streamwish":
      case "filemoon":
      case "dood":
        return await resolveGeneric(url);

      default:
        return await resolveGeneric(url);
    }

  } catch {
    return null;
  }
}
