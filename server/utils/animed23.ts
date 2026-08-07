import { fetchHtml } from "./fetcher";

export interface AnimeD23Server {
  name: string;
  url: string;
  type: "mp4" | "iframe";
  lang: string; // "sub", "lat", "cast"
}

// ----------------------------------------------------------
// EXTRAER SERVIDOR MYT DE ANIMED23 (VIDEO CRUDO ARCHIVE.ORG)
// ----------------------------------------------------------
export async function getAnimeD23Servers(
  slug: string,
  episode: number
): Promise<AnimeD23Server[]> {
  // Construir URL del episodio (formato: /capitulo/{slug}-{episode}/)
  const url = `https://animed23.com/capitulo/${slug}-${episode}/`;
  const html = await fetchHtml(url);
  if (!html) return [];

  // Extraer todas las opciones del <select name="mirror">
  const selectRegex = /<select[^>]*name="mirror"[^>]*>([\s\S]*?)<\/select>/i;
  const selectMatch = html.match(selectRegex);
  if (!selectMatch) return [];

  const optionsHtml = selectMatch[1];
  const optionRegex = /<option[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/gi;
  const servers: AnimeD23Server[] = [];
  const seen = new Set<string>();

  let optionMatch;
  while ((optionMatch = optionRegex.exec(optionsHtml)) !== null) {
    const b64Value = optionMatch[1];
    if (!b64Value) continue;

    // Decodificar Base64 del value (contiene un iframe)
    let iframeHtml = "";
    try {
      iframeHtml = atob(b64Value);
    } catch {
      continue;
    }

    // Extraer la URL del iframe
    const iframeSrc = iframeHtml.match(/src="([^"]+)"/);
    if (!iframeSrc) continue;
    const iframeUrl = iframeSrc[1];

    // Parsear la URL del iframe para obtener el parámetro "value"
    const iframeUrlObj = new URL(iframeUrl);
    const encodedValue = iframeUrlObj.searchParams.get("value");
    const bgParam = iframeUrlObj.searchParams.get("bg") || "";

    if (!encodedValue) continue;

    // Decodificar el JSON de idiomas
    let langTokens: Record<string, string> = {};
    try {
      const jsonStr = atob(encodedValue);
      langTokens = JSON.parse(jsonStr);
    } catch {
      continue;
    }

    // Para cada idioma (sub, lat, cast) presente en el JSON
    for (const lang of ["sub", "lat", "cast"]) {
      if (!langTokens[lang]) continue;

      // Crear un nuevo JSON solo con ese idioma
      const newToken = { [lang]: langTokens[lang] };
      const newEncodedValue = btoa(JSON.stringify(newToken));

      // Construir la URL de options.php con el token individual
      const optionsUrl = new URL(iframeUrl);
      optionsUrl.searchParams.set("value", newEncodedValue);
      if (bgParam) optionsUrl.searchParams.set("bg", bgParam);

      // Hacer fetch y seguir redirección para obtener la URL final del MP4
      try {
        const response = await fetch(optionsUrl.toString(), {
          method: "GET",
          redirect: "manual", // No seguir automáticamente, queremos capturar el 302
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Referer": "https://animed23.com/",
          },
        });

        if (response.status === 302 || response.status === 301) {
          const location = response.headers.get("location");
          if (location && !seen.has(location)) {
            seen.add(location);
            servers.push({
              name: `myt - ${lang.toUpperCase()}`,
              url: location,
              type: "mp4", // siempre es MP4 en archive.org
              lang: lang,
            });
          }
        } else {
          // Si no hay redirección, usar la URL del iframe como fallback
          if (!seen.has(optionsUrl.toString())) {
            seen.add(optionsUrl.toString());
            servers.push({
              name: `myt - ${lang.toUpperCase()}`,
              url: optionsUrl.toString(),
              type: "iframe",
              lang: lang,
            });
          }
        }
      } catch {
        // Error de red, ignorar este idioma
        continue;
      }
    }
  }

  return servers;
}
