import { fetchHtml } from "./fetcher";

const PROXY = "https://zetapi-api.samvelzeta.workers.dev/proxy?url=";

export interface AnimeFLVServer {
  name: string;
  url: string;
  type: "iframe" | "hls";
}

export async function getAnimeFLVServers(
  slug: string,
  episode: number
): Promise<{ servers: AnimeFLVServer[]; latestEpisode: number | null }> {
  // Intentamos varias variantes de URL
  const urls = [
    `https://animeflv.or.at/anime/${slug}/episodio-${episode}/`,
    `https://animeflv.or.at/${slug}/episodio-${episode}/`,
  ];
  let html: string | null = null;
  for (const u of urls) {
    html = await fetchHtml(u);
    if (html) break;
  }
  if (!html) return { servers: [], latestEpisode: null };

  const servers: AnimeFLVServer[] = [];
  const seen = new Set<string>();

  // Extraer servidores de los botones data-src
  const buttonRegex = /<button[^>]*data-src="([^"]+)"[^>]*>([^<]*)<\/button>/gi;
  let match;
  while ((match = buttonRegex.exec(html)) !== null) {
    const b64 = match[1];
    const label = match[2].trim() || "Server";
    try {
      const decoded = atob(b64);
      if (!decoded || seen.has(decoded)) continue;
      seen.add(decoded);

      // Envolver turbovidhls con proxy para evitar CORS/pantalla negra
      const finalUrl = decoded.includes("turbovidhls.com")
        ? `${PROXY}${encodeURIComponent(decoded)}`
        : decoded;

      servers.push({
        name: label,
        url: finalUrl,
        type: decoded.includes("turbovidhls.com") ? "hls" : "iframe",
      });
    } catch {}
  }

  // Obtener último episodio desde la lista de episodios en la misma página
  let latestEpisode: number | null = null;
  const epListMatch = html.match(
    /class="episodes-grid"[^>]*>([\s\S]*?)<\/div>/i
  );
  if (epListMatch) {
    const numbers = [...epListMatch[1].matchAll(/>(\d+)<\//g)];
    const nums = numbers.map(m => parseInt(m[1])).filter(n => !isNaN(n));
    if (nums.length) latestEpisode = Math.max(...nums);
  }

  return { servers, latestEpisode };
}
