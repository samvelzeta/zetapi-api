import { normalizeUrl } from "./serverTypes";

// ==============================
export async function resolveServer(rawUrl: string): Promise<string | null> {

  try {

    const url = normalizeUrl(rawUrl);
    if (!url) return null;

    // 🔥 NO TOCAR ZILLA
    if (url.includes("zilla-networks")) {
      return url;
    }

    // 🔥 DIRECTO
    if (url.includes(".m3u8") || url.includes(".mp4")) {
      return url;
    }

    return url;

  } catch {
    return rawUrl;
  }
}
