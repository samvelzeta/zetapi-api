import { fetchHtml } from "./fetcher";

export interface SoloLatinoServer {
  name: string;
  url: string;
  type: "iframe";
}

// ----------------------------------------------------------
// EXTRAER SERVIDORES DE SOLOLATINO (VIP y otros iframes)
// ----------------------------------------------------------
export async function getSoloLatinoServers(
  slug: string,
  season: number,
  episode: number
): Promise<SoloLatinoServer[]> {
  const url = `https://sololatino.net/serie/${slug}/temporada-${season}/episodio-${episode}`;
  const html = await fetchHtml(url);
  if (!html) return [];

  const servers: SoloLatinoServer[] = [];
  const seen = new Set<string>();

  // 1. Buscar iframes cuyo src contenga "player.pelisserieshoy.com"
  const iframeRegex =
    /<iframe[^>]+src="(https:\/\/player\.pelisserieshoy\.com\/f\/[^"]+)"/gi;
  let match;
  while ((match = iframeRegex.exec(html)) !== null) {
    const iframeUrl = match[1];
    if (!seen.has(iframeUrl)) {
      seen.add(iframeUrl);
      servers.push({ name: "", url: iframeUrl, type: "iframe" });
    }
  }

  // 2. Buscar URLs de pelisserieshoy dentro de scripts (posibles VIP)
  const scriptRegex =
    /"url":"(https:\\\/\\\/player\.pelisserieshoy\.com\\\/f\\\/[^"]+)"/g;
  while ((match = scriptRegex.exec(html)) !== null) {
    let iframeUrl = match[1].replace(/\\\//g, "/");
    if (!seen.has(iframeUrl)) {
      seen.add(iframeUrl);
      servers.push({ name: "", url: iframeUrl, type: "iframe" });
    }
  }

  // 3. Buscar otros iframes genéricos de reproductores conocidos (opcional)
  const genericIframes = html.matchAll(
    /<iframe[^>]+src="(https:\/\/(?:player\.pelisserieshoy|embed69|pelisplay|streamtape|ok\.ru|dood|uqload)\.com\/[^"]+)"/gi
  );
  for (const m of genericIframes) {
    const src = m[1];
    if (!seen.has(src)) {
      seen.add(src);
      servers.push({ name: "", url: src, type: "iframe" });
    }
  }

  return servers;
}
