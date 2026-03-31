// ==============================
// 🔥 DETECTOR DE SERVIDORES
// ==============================

export type ServerType =
  | "hls"
  | "mp4"
  | "streamwish"
  | "filemoon"
  | "dood"
  | "streamtape"
  | "okru"
  | "uqload"
  | "vidhide"
  | "voe"
  | "generic";

// ==============================
// 🔥 NORMALIZADOR DE URL
// ==============================
export function normalizeUrl(url: string): string {
  try {
    return decodeURIComponent(url).trim();
  } catch {
    return url;
  }
}

// ==============================
// 🔥 DETECTAR TIPO DE SERVIDOR
// ==============================
export function detectServerType(rawUrl: string): ServerType {

  const url = normalizeUrl(rawUrl).toLowerCase();

  // ==========================
  // 🥇 DIRECTOS
  // ==========================
  if (url.includes(".m3u8")) return "hls";
  if (url.includes(".mp4")) return "mp4";

  // ==========================
  // 🥇 SERVERS PRINCIPALES
  // ==========================
  if (url.includes("streamwish") || url.includes("wish") || url.includes("sw")) {
    return "streamwish";
  }

  if (url.includes("filemoon")) {
    return "filemoon";
  }

  if (url.includes("dood") || url.includes("doodstream")) {
    return "dood";
  }

  if (url.includes("streamtape")) {
    return "streamtape";
  }

  // ==========================
  // 🥈 OTROS COMUNES
  // ==========================
  if (url.includes("ok.ru") || url.includes("okru")) {
    return "okru";
  }

  if (url.includes("uqload")) {
    return "uqload";
  }

  if (url.includes("vidhide")) {
    return "vidhide";
  }

  if (url.includes("voe")) {
    return "voe";
  }

  // ==========================
  // 🧠 FALLBACK
  // ==========================
  return "generic";
}

// ==============================
// 🔥 VALIDAR URL DE VIDEO
// ==============================
export function isValidVideo(url: string | null): boolean {
  if (!url) return false;

  return (
    url.includes(".m3u8") ||
    url.includes(".mp4") ||
    url.includes("playlist")
  );
}
