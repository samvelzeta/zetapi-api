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
export function normalizeUrl(url: string): string {
  try {
    return decodeURIComponent(url).trim();
  } catch {
    return url;
  }
}

// ==============================
export function detectServerType(rawUrl: string): ServerType {

  const url = normalizeUrl(rawUrl).toLowerCase();

  // 🔥 HLS MÁS ROBUSTO
  if (
    url.includes(".m3u8") ||
    url.includes("playlist.m3u8") ||
    url.includes("/hls/") ||
    url.includes("master.m3u8")
  ) return "hls";

  if (url.includes(".mp4")) return "mp4";

  if (url.includes("streamwish") || url.includes("wish")) {
    return "streamwish";
  }

  if (url.includes("filemoon")) return "filemoon";
  if (url.includes("dood")) return "dood";
  if (url.includes("streamtape")) return "streamtape";
  if (url.includes("ok.ru")) return "okru";
  if (url.includes("uqload")) return "uqload";
  if (url.includes("vidhide")) return "vidhide";
  if (url.includes("voe")) return "voe";

  return "generic";
}

// ==============================
export function isValidVideo(url?: string | null): boolean {
  if (!url) return false;

  const u = url.toLowerCase();

  return (
    u.includes(".m3u8") ||
    u.includes(".mp4")
  );
}
