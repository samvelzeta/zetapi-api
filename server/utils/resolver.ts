import { detectServerType, normalizeUrl } from "./serverTypes";

// ==============================
function getHeaders(url: string) {
  const origin = new URL(url).origin;

  return {
    "User-Agent": "Mozilla/5.0",
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
// 🔥 ZILLA → intenta HLS
function resolveZilla(url: string): string | null {

  const match = url.match(/play\/([a-z0-9]+)/i);
  if (!match) return null;

  const id = match[1];

  return `https://cdn.zilla-networks.com/hls/${id}/master.m3u8`;
}

// ==============================
// 🔥 VALIDAR SI HLS FUNCIONA
async function validateStream(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

// ==============================
// 🔥 RESOLVER GENERICO
async function resolveGeneric(url: string): Promise<string | null> {

  // 🔥 ZILLA
  if (url.includes("zilla-networks")) {

    const hls = resolveZilla(url);

    if (hls) {
      const ok = await validateStream(hls);

      // ✔ si funciona, úsalo
      if (ok) return hls;

      // ❌ si no → fallback embed
      return url;
    }

    return url;
  }

  const html = await fetchHtml(url);
  if (!html) return url;

  const match = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/);
  if (match) return match[0];

  return url;
}

// ==============================
// 🔥 PRINCIPAL
export async function resolveServer(rawUrl: string): Promise<string | null> {

  try {

    const url = normalizeUrl(rawUrl);
    if (!url) return null;

    // 🔥 directo
    if (url.includes(".m3u8") || url.includes(".mp4")) {
      return url;
    }

    return await resolveGeneric(url);

  } catch {
    return rawUrl; // fallback total
  }
}
