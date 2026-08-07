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
// EXTRAER MAGI/DESU (IFRAMES ORIGINALES)
// ----------------------------------------------------------
export async function getJKAnimeServers(slug: string, episode: number): Promise<JKServer[]> {
  const url = `https://jkanime.net/${slug}/${episode}/`;
  const html = await fetchHtml(url);
  if (!html) return [];

  const servers: JKServer[] = [];
  const seen = new Set<string>();

  const videoMatches = html.matchAll(
    /video\[(\d+)\]\s*=\s*'<iframe[^>]+src="([^"]+)"/g
  );
  for (const match of videoMatches) {
    const idx = parseInt(match[1]);
    const iframeUrl = match[2];
    const name = idx === 0 ? "Desu" : idx === 1 ? "Magi" : `Server${idx}`;
    const fullUrl = iframeUrl.startsWith("http")
      ? iframeUrl
      : `https://jkanime.net${iframeUrl}`;
    if (!seen.has(fullUrl)) {
      seen.add(fullUrl);
      servers.push({ name, url: fullUrl, type: "iframe" });
    }
  }

  return servers;
}

// ----------------------------------------------------------
// SUBTÍTULOS EN ESPAÑOL
// ----------------------------------------------------------
export async function getJKAnimeSubtitles(slug: string, episode: number): Promise<JKSubtitle[]> {
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

// ----------------------------------------------------------
// OBTENER ÚLTIMO EPISODIO (CONTANDO LI O PAGINATIONEPS)
// ----------------------------------------------------------
export async function getJKAnimeLatestEpisode(slug: string): Promise<number | null> {
  const url = `https://jkanime.net/${slug}/`;
  const html = await fetchHtml(url);
  if (!html) return null;

  // Método 1: contar elementos <li> en la lista de episodios
  const lis = html.match(/<li[^>]*class="[^"]*episode-item[^"]*"/g);
  if (lis) return lis.length;

  // Método 2: usar paginationEps(numero)
  const pagMatch = html.match(/paginationEps\((\d+)\)/);
  if (pagMatch) return parseInt(pagMatch[1]);

  // Método 3: AJAX a /ajax/episodes/ID/1
  const idMatch = html.match(/anime_checks\('([^']+)',\s*'(\d+)'\)/);
  if (idMatch) {
    const animeId = idMatch[2];
    const ajaxRes = await fetchHtml(`https://jkanime.net/ajax/episodes/${animeId}/1`, {
      method: "POST",
      body: "_token=dummy",
    });
    if (ajaxRes) {
      try {
        const data = JSON.parse(ajaxRes);
        return data.data?.length || null;
      } catch {}
    }
  }

  return null;
}
