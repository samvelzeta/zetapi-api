import { fetchHtml } from "./fetcher";
import { detectServerType, normalizeUrl } from "./serverTypes";

export const KNOWN_PROVIDERS = [
  "hls",
  "mp4",
  "streamwish",
  "filemoon",
  "dood",
  "streamtape",
  "okru",
  "uqload",
  "vidhide",
  "voe",
  "generic"
] as const;

function extractDirectFromText (html: string): string | null {
  const patterns = [
    /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/i,
    /https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i,
    /"hlsManifestUrl":"([^"]+)"/i,
    /(?:file|src)\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/i,
    /(?:file|src)\s*[:=]\s*["']([^"']+\.mp4[^"']*)["']/i
  ];

  for (const p of patterns) {
    const m = html.match(p);
    if (!m) continue;

    const val = m[1] || m[0];
    if (!val) continue;

    const clean = val
      .replace(/\\\//g, "/")
      .replace(/\\u0026/g, "&")
      .replace(/^\/+/, "https://");

    if (clean.startsWith("http")) return clean;
  }

  return null;
}

function extractJsLikeUrls (html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  const pushUrl = (u: string) => {
    try {
      if (!u) return;
      const clean = u
        .replace(/\\\//g, "/")
        .replace(/\\u0026/g, "&")
        .replace(/^\/\//, "https://");
      const absolute = new URL(clean, baseUrl).toString();
      if (absolute.startsWith("http")) out.add(absolute);
    }
    catch {
      return;
    }
  };

  // urls directas o escapadas dentro de JS/HTML
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)) pushUrl(m[0]);
  for (const m of html.matchAll(/(?:src|file|url|iframe)\s*[:=]\s*["']([^"']+)["']/gi)) pushUrl(m[1]);
  for (const m of html.matchAll(/data-player=["']([^"']+)["']/gi)) {
    try {
      pushUrl(decodeURIComponent(m[1]));
    }
    catch {
      pushUrl(m[1]);
    }
  }

  // payloads base64 comunes en scripts de player
  for (const m of html.matchAll(/atob\(["']([A-Za-z0-9+/=]{16,})["']\)/gi)) {
    try {
      const decoded = atob(m[1]);
      const nested = extractDirectFromText(decoded);
      if (nested) pushUrl(nested);
      for (const uu of decoded.match(/https?:\/\/[^\s"'<>\\]+/gi) || []) pushUrl(uu);
    }
    catch {
      continue;
    }
  }

  return Array.from(out);
}

async function resolveFromHtml (url: string): Promise<string | null> {
  const html = await fetchHtml(url, { minLength: 40, retries: 1, timeoutMs: 7000 });
  if (!html) return null;

  const direct = extractDirectFromText(html);
  if (direct) return direct;

  const iframe = html.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];
  if (iframe) {
    const iframeUrl = new URL(iframe, url).toString();
    const nested = await fetchHtml(iframeUrl, { minLength: 40, retries: 1, timeoutMs: 7000 });
    if (!nested) return iframeUrl;
    return extractDirectFromText(nested) || iframeUrl;
  }

  // fallback: extraer posibles URLs de scripts/JS y resolver en cascada
  const jsCandidates = extractJsLikeUrls(html, url).slice(0, 10);
  for (const candidate of jsCandidates) {
    if (candidate.includes(".m3u8") || candidate.includes(".mp4")) return candidate;
  }

  for (const candidate of jsCandidates) {
    const nested = await fetchHtml(candidate, { minLength: 30, retries: 1, timeoutMs: 6000 });
    if (!nested) continue;
    const nestedDirect = extractDirectFromText(nested);
    if (nestedDirect) return nestedDirect;
  }

  return null;
}

async function resolveStreamtape (url: string): Promise<string | null> {
  const html = await fetchHtml(url, { minLength: 40, retries: 1, timeoutMs: 7000 });
  if (!html) return null;

  const direct = extractDirectFromText(html);
  if (direct) return direct;

  const id = html.match(/id=([a-zA-Z0-9]+)/)?.[1];
  const expires = html.match(/expires=([0-9]+)/)?.[1];
  const ip = html.match(/ip=([0-9.]+)/)?.[1];

  if (id && expires) {
    const query = new URLSearchParams({ id, expires });
    if (ip) query.set("ip", ip);
    return `https://streamtape.com/get_video?${query.toString()}`;
  }

  return null;
}

async function resolveOkru (url: string): Promise<string | null> {
  const html = await fetchHtml(url, { minLength: 40, retries: 1, timeoutMs: 7000 });
  if (!html) return null;

  const hls = html.match(/"hlsManifestUrl":"([^"]+)"/)?.[1];
  if (hls) return hls.replace(/\\\//g, "/");

  return extractDirectFromText(html);
}

async function resolveDood (url: string): Promise<string | null> {
  // doodstream suele requerir token dinámico; dejamos fallback a enlace embebido si no hay directo
  const html = await fetchHtml(url, { minLength: 40, retries: 1, timeoutMs: 7000 });
  if (!html) return null;

  const direct = extractDirectFromText(html);
  return direct || url;
}

async function resolveGeneric (url: string): Promise<string | null> {
  const fromHtml = await resolveFromHtml(url);
  return fromHtml || url;
}

export async function resolveServer (rawUrl: string): Promise<string | null> {
  try {
    const url = normalizeUrl(rawUrl);
    if (!url) return null;

    if (url.includes("zilla-networks")) {
      return await resolveFromHtml(url) || url;
    }

    const type = detectServerType(url);

    if (type === "hls" || type === "mp4") return url;

    switch (type) {
      case "streamwish":
      case "filemoon":
      case "vidhide":
      case "voe":
      case "uqload":
        return await resolveFromHtml(url) || url;

      case "streamtape":
        return await resolveStreamtape(url) || url;

      case "okru":
        return await resolveOkru(url) || url;

      case "dood":
        return await resolveDood(url) || url;

      default:
        return await resolveGeneric(url);
    }
  }
  catch {
    return rawUrl;
  }
}
