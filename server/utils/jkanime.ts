import { fetchHtml } from "./fetcher";

export interface JKServer {
  name: string;
  url: string;
  type: "iframe";
}

export interface JKSubtitle {
  lang: string;
  url: string;
}

// ----------------------------------------------------------
// EXTRAER MAGI/DESU (VIDEO[] IFRAMES)
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
  const regex = /video\s*\[\s*(\d+)\s*\]\s*=\s*(['"])([\s\S]*?)\2\s*;/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const index = parseInt(match[1]);
    const iframeHtml = match[3];
    const iframeMatch = iframeHtml.match(/<iframe\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1/i);
    if (!iframeMatch) continue;

    let iframeUrl = iframeMatch[2]
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

    if (iframeUrl.startsWith("//")) iframeUrl = "https:" + iframeUrl;
    if (iframeUrl.startsWith("/")) iframeUrl = `https://jkanime.net${iframeUrl}`;
    if (!/^https?:\/\//i.test(iframeUrl)) continue;

    if (seen.has(iframeUrl)) continue;
    seen.add(iframeUrl);

    servers.push({
      name: index === 0 ? "Desu" : index === 1 ? "Magi" : `Server ${index + 1}`,
      url: iframeUrl,
      type: "iframe"
    });
  }
  return servers;
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
  const subMatches = html.matchAll(
    /<button[^>]+data-url="([^"]+)"[^>]+data-language="([^"]*)"[^>]*>/g
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

// ----------------------------------------------------------
// OBTENER ÚLTIMO EPISODIO
// ----------------------------------------------------------
export async function getJKAnimeLatestEpisode(slug: string): Promise<number | null> {
  const url = `https://jkanime.net/${slug}/`;
  const html = await fetchHtml(url);
  if (!html) return null;

  // Método 1: paginationEps(numero)
  const pagMatch = html.match(/paginationEps\((\d+)\)/);
  if (pagMatch) return parseInt(pagMatch[1]);

  // Método 2: AJAX a /ajax/episodes/ID/1
  const idMatch = html.match(/anime_checks\('([^']+)',\s*'(\d+)'\)/);
  if (idMatch) {
    const animeId = idMatch[2];
    const ajaxRes = await fetchHtml(`https://jkanime.net/ajax/episodes/${animeId}/1`, {
      method: "POST",
      body: "_token=dummy"
    });
    if (ajaxRes) {
      try {
        const data = JSON.parse(ajaxRes);
        return data.data?.length || null;
      } catch {}
    }
  }

  // Método 3: contar enlaces de episodios en la lista (si es visible)
  const episodeLinks = html.match(/<a[^>]+href="[^"]*\/\d+\/?/g);
  if (episodeLinks) {
    const nums = episodeLinks
      .map(h => h.match(/\/(\d+)\//))
      .filter(m => m)
      .map(m => parseInt(m![1]))
      .filter(n => !isNaN(n));
    if (nums.length) return Math.max(...nums);
  }

  return null;
}
