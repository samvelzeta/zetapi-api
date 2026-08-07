import { fetchHtml } from "./fetcher";

export interface JKServer {
  name: string;   // ahora vacío; se rellena en getServers
  url: string;
  type: "iframe" | "mp4";
}

export interface JKSubtitle {
  lang: string;
  url: string;
}

// ----------------------------------------------------------
// EXTRAER SERVIDORES DE JKANIME (Magi, Desu, YourUpload, Mega)
// ----------------------------------------------------------
export async function getJKAnimeServers(
  slug: string,
  episode: number
): Promise<JKServer[]> {
  const url = `https://jkanime.net/${slug}/${episode}/`;
  const html = await fetchHtml(url);
  if (!html) return [];

  const servers: JKServer[] = [];
  const seen = new Set<string>();

  // --- 1. MAGI y DESU (video[0] y video[1]) ---
  const videoMatches = html.matchAll(
    /video\[(\d+)\]\s*=\s*'<iframe[^>]+src="([^"]+)"/g
  );
  for (const match of videoMatches) {
    const idx = parseInt(match[1]);
    const iframeUrl = match[2];
    const name = idx === 0 ? "Desu" : idx === 1 ? "Magi" : `Server${idx}`;
    // name temporal, lo sobrescribiremos luego
    const fullUrl = iframeUrl.startsWith("http")
      ? iframeUrl
      : `https://jkanime.net${iframeUrl}`;
    if (!seen.has(fullUrl)) {
      seen.add(fullUrl);
      servers.push({ name: "" /* vacío */, url: fullUrl, type: "iframe" });
    }
  }

  // --- 2. YOURUPLOAD y MEGA ---
  const serversMatch = html.match(/var servers = (\[.*?\]);/s);
  if (serversMatch) {
    try {
      const rawList = JSON.parse(serversMatch[1]);
      for (const item of rawList) {
        if (item.server !== "YourUpload" && item.server !== "Mega") continue;

        if (item.server === "YourUpload") {
          const playerIframe = `https://jkanime.net/jkplayer/c1?u=${encodeURIComponent(item.remote)}&s=yourupload`;
          if (!seen.has(playerIframe)) {
            seen.add(playerIframe);
            servers.push({ name: "", url: playerIframe, type: "iframe" });
          }
        } else if (item.server === "Mega") {
          let realUrl = "";
          try { realUrl = atob(item.remote); } catch { realUrl = atob(item.remote + "=="); }
          if (realUrl && realUrl.startsWith("http") && !seen.has(realUrl)) {
            seen.add(realUrl);
            servers.push({ name: "", url: realUrl, type: "mp4" });
          }
        }
      }
    } catch { /* ignorar errores de parseo */ }
  }

  return servers;
}

// ----------------------------------------------------------
// SUBTÍTULOS (sin cambios)
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
  const subMatches = html.matchAll(
    /<button[^>]*data-url="([^"]+)"[^>]*data-language="([^"]*)"[^>]*>/g
  );
  for (const m of subMatches) {
    const subUrl = m[1];
    const lang = m[2].toLowerCase();
    if ((lang === "es" || lang.includes("spa") || lang.includes("español")) && !seen.has(subUrl)) {
      seen.add(subUrl);
      subs.push({ lang: "Español", url: subUrl });
    }
  }
  return subs;
}
