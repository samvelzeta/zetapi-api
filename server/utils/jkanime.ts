// ==============================
// 🔥 JKANIME SCRAPER PURO
// Magi, Desu, YourUpload, Mega
// Subtítulos en español
// ==============================
import { fetchHtml } from "./fetcher";

export interface JKServer {
  name: string;
  url: string;
  type: "hls" | "mp4" | "iframe";
}

export interface JKSubtitle {
  lang: string;
  url: string;
}

// ----------------------------------------------------------
// RESOLVER IFRAME DE JKCORE (MAGI / DESU)
// Busca la URL real (m3u8/mp4) sin ejecutar JS peligroso
// ----------------------------------------------------------
async function resolveJKPlayer(iframeSrc: string): Promise<string | null> {
  const fullUrl = iframeSrc.startsWith("http")
    ? iframeSrc
    : `https://jkanime.net${iframeSrc}`;

  const html = await fetchHtml(fullUrl);
  if (!html) return null;

  // 1. .m3u8 directo
  const m3u8 = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
  if (m3u8) return m3u8[1];

  // 2. <source src="...">
  const source = html.match(/<source[^>]+src="([^"]+)"/i);
  if (source) return source[1];

  // 3. variable de JavaScript (file:, source:, src:)
  const jsUrl = html.match(/(?:file|source|src)\s*:\s*['"]([^'"]+)['"]/i);
  if (jsUrl) return jsUrl[1];

  // Si todo falla, devolvemos la URL del iframe para que el frontend lo maneje
  return fullUrl;
}

// ----------------------------------------------------------
// EXTRAER MAGI, DESU, YOURUPLOAD Y MEGA
// ----------------------------------------------------------
export async function getJKAnimeServers(
  slug: string,
  episode: number
): Promise<JKServer[]> {
  const url = `https://jkanime.net/${slug}/${episode}/`;
  const html = await fetchHtml(url);
  if (!html) return [];

  const servers: JKServer[] = [];

  // ---------- MAGI y DESU (video[0] / video[1]) ----------
  const videoMatches = html.matchAll(
    /video\[(\d+)\]\s*=\s*'<iframe[^>]+src="([^"]+)"/g
  );

  for (const match of videoMatches) {
    const idx = parseInt(match[1]);
    const iframeUrl = match[2];
    const name = idx === 0 ? "Desu" : idx === 1 ? "Magi" : `Server${idx}`;

    const realUrl = await resolveJKPlayer(iframeUrl);
    if (realUrl) {
      servers.push({
        name,
        url: realUrl,
        type: realUrl.includes(".m3u8") ? "hls" : "mp4",
      });
    }
  }

  // ---------- YOURUPLOAD y MEGA (array var servers) ----------
  const serversMatch = html.match(/var servers = (\[.*?\]);/s);
  if (serversMatch) {
    try {
      const rawList = JSON.parse(serversMatch[1]);
      const allowed = ["YourUpload", "Mega"]; // solo los que NO tienen anuncios

      for (const item of rawList) {
        if (!allowed.includes(item.server)) continue;
        if (!item.remote) continue;

        let realUrl = "";
        try {
          realUrl = atob(item.remote);
        } catch {
          realUrl = atob(item.remote + "==");
        }

        if (realUrl && realUrl.startsWith("http")) {
          servers.push({
            name: item.server,
            url: realUrl,
            type: realUrl.includes(".m3u8") ? "hls" : "mp4",
          });
        }
      }
    } catch {
      // silencioso
    }
  }

  // Eliminar duplicados (por URL sin query)
  const seen = new Set<string>();
  return servers.filter((s) => {
    const base = s.url.split("?")[0];
    if (seen.has(base)) return false;
    seen.add(base);
    return true;
  });
}

// ----------------------------------------------------------
// SUBTÍTULOS EN ESPAÑOL
// ----------------------------------------------------------
export async function getJKAnimeSubtitles(
  slug: string,
  episode: number
): Promise<JKSubtitle[]> {
  const url = `https://jkanime.net/${slug}/${episode}/`;
  const html = await fetchHtml(url);
  if (!html) return [];

  const subs: JKSubtitle[] = [];
  const seen = new Set<string>();

  // Botones data-url / data-language
  const subMatches = html.matchAll(
    /<button[^>]*data-url="([^"]+)"[^>]*data-language="([^"]*)"[^>]*>/g
  );

  for (const m of subMatches) {
    const subUrl = m[1];
    const lang = m[2].toLowerCase();
    if (
      (lang === "es" || lang.includes("spa") || lang.includes("español")) &&
      !seen.has(subUrl)
    ) {
      seen.add(subUrl);
      subs.push({ lang: "Español", url: subUrl });
    }
  }

  return subs;
}
