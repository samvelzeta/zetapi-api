import { $fetch } from "ofetch";
import { detectServerType, isValidVideo } from "./serverTypes";

// ==============================ssssssssssssssssssss
function getHeaders(url: string) {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Referer": new URL(url).origin,
    "Origin": new URL(url).origin
  };
}

// ==============================
async function validateHLS(url: string): Promise<boolean> {
  try {
    const res = await $fetch(url, { headers: getHeaders(url) });

    const text = typeof res === "string" ? res : JSON.stringify(res);

    const segments = text.match(/\.ts/g);

    // 🔥 evitar clips
    if (!segments || segments.length < 30) return false;

    return true;

  } catch {
    return false;
  }
}

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
function extractVideo(html: string): string | null {

  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  if (m3u8?.length) return m3u8[0];

  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  if (mp4?.length) return mp4[0];

  return null;
}

// ==============================
async function resolveGeneric(url: string): Promise<string | null> {

  const html = await fetchHtml(url);
  if (!html) return null;

  const video = extractVideo(html);
  if (!video) return null;

  if (video.includes(".m3u8")) {
    const valid = await validateHLS(video);
    if (!valid) return null;
  }

  if (isValidVideo(video)) return video;

  return null;
}

// ==============================
export async function resolveServer(url: string): Promise<string | null> {

  if (!url) return null;

  const type = detectServerType(url);

  if (type === "hls") {
    const valid = await validateHLS(url);
    return valid ? url : null;
  }

  if (type === "mp4") return url;

  return await resolveGeneric(url);
}
