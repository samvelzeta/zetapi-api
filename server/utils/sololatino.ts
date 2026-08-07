import { fetchHtml } from "./fetcher";

export interface SoloLatinoServer {
  name: string;
  url: string;
  type: "iframe";
}

/**
 * Obtiene el token CSRF desde el meta tag de la página.
 */
function extractCsrfToken(html: string): string | null {
  const match = html.match(
    /<meta name="csrf-token" content="([^"]+)"/
  );
  return match ? match[1] : null;
}

/**
 * Llama a la API interna de SoloLatino para obtener las URLs de los reproductores.
 */
async function fetchPlayerUrls(
  slug: string,
  season: number,
  episode: number,
  csrfToken: string
): Promise<string[]> {
  const apiUrl = "https://sololatino.net/api/player-url";
  const payload = {
    t: csrfToken, // El token CSRF se envía como "t"
    // Otros parámetros que puedan ser necesarios según la página
    // (pueden ser deducidos del HTML)
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
        "X-Requested-With": "XMLHttpRequest",
        "Referer": `https://sololatino.net/serie/${slug}/temporada-${season}/episodio-${episode}`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return [];
    const data = await response.json();
    // La respuesta puede ser un objeto simple o un array de servidores
    if (Array.isArray(data)) {
      return data
        .filter((item: any) => item.url && item.type === "iframe")
        .map((item: any) => item.url.replace(/\\\//g, "/"));
    } else if (data.url) {
      return [data.url.replace(/\\\//g, "/")];
    }
    return [];
  } catch {
    return [];
  }
}

export async function getSoloLatinoServers(
  slug: string,
  season: number,
  episode: number
): Promise<SoloLatinoServer[]> {
  const pageUrl = `https://sololatino.net/serie/${slug}/temporada-${season}/episodio-${episode}`;
  const html = await fetchHtml(pageUrl);
  if (!html) return [];

  const csrfToken = extractCsrfToken(html);
  if (!csrfToken) return [];

  const iframeUrls = await fetchPlayerUrls(slug, season, episode, csrfToken);
  const servers: SoloLatinoServer[] = [];
  const seen = new Set<string>();

  for (const url of iframeUrls) {
    if (!seen.has(url)) {
      seen.add(url);
      servers.push({ name: "", url, type: "iframe" });
    }
  }

  return servers;
}
