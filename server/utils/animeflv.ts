import { fetchHtml } from "./fetcher";

export interface AnimeFLVServer {
  name: string;
  url: string;
  type: "iframe" | "embed";
}

// ----------------------------------------------------------
// EXTRAER SERVIDORES DE ANIMEFLV (TURBOVID, UPNShare, Mega, etc.)
// ----------------------------------------------------------
export async function getAnimeFLVServers(
  slug: string,
  episode: number
): Promise<AnimeFLVServer[]> {
  // Construir URL del episodio
  // El slug en animeflv suele ser igual al título en minúsculas con guiones
  const url = `https://animeflv.or.at/anime/${slug}/episodio-${episode}/`;
  const html = await fetchHtml(url);
  if (!html) return [];

  // Buscar todos los botones con data-src (contienen URLs en Base64)
  const buttonRegex = /<button[^>]*data-src="([^"]+)"[^>]*>([^<]*)<\/button>/gi;
  const servers: AnimeFLVServer[] = [];
  const seen = new Set<string>();

  let match;
  while ((match = buttonRegex.exec(html)) !== null) {
    const b64Url = match[1];
    const label = match[2].trim() || "Server";
    
    if (!b64Url) continue;

    // Decodificar Base64 para obtener la URL real
    let decodedUrl = "";
    try {
      decodedUrl = atob(b64Url);
    } catch {
      continue;
    }

    if (!decodedUrl || seen.has(decodedUrl)) continue;
    seen.add(decodedUrl);

    servers.push({
      name: label,
      url: decodedUrl,
      type: "iframe",
    });
  }

  return servers;
}
