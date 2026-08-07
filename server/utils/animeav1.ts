import { fetchHtml } from "./fetcher";

export interface AV1Server {
  name: string;
  url: string;
  type: "iframe";
}

/**
 * Extrae el array "data" pasado a kit.start() en el HTML de AnimeAV1.
 * Busca la cadena 'data:' y extrae el JSON del array usando conteo de corchetes.
 */
function extractDataArray(html: string): any[] | null {
  // Buscar 'data:' (sin comillas, porque es parte del objeto de opciones)
  const marker = 'data:';
  let pos = html.indexOf(marker);
  if (pos === -1) return null;

  // Avanzar hasta el primer '[' después de 'data:'
  let start = html.indexOf('[', pos);
  if (start === -1) return null;

  // Conteo de corchetes para extraer todo el array
  let depth = 0;
  let end = start;
  for (let i = start; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  const arrayStr = html.substring(start, end + 1);
  try {
    return JSON.parse(arrayStr);
  } catch (e) {
    // Fallback: a veces la cadena contiene caracteres escapados extra
    // Limpiar y volver a intentar
    const cleaned = arrayStr.replace(/\\"/g, '"').replace(/\\n/g, '');
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

export async function getAnimeAV1Servers(
  slug: string,
  episode: number
): Promise<AV1Server[]> {
  const url = `https://animeav1.com/media/${slug}/${episode}`;
  const html = await fetchHtml(url);
  if (!html) return [];

  const dataArray = extractDataArray(html);
  if (!dataArray) return [];

  // Buscar el objeto que contiene "embeds"
  const episodeData = dataArray.find(
    (item: any) => item?.type === 'data' && item?.data?.embeds
  );
  if (!episodeData) return [];

  const embeds = episodeData.data.embeds;
  const servers: AV1Server[] = [];
  const seen = new Set<string>();

  // Recorrer todos los idiomas y servidores
  for (const lang of Object.keys(embeds)) {
    const langEmbeds = embeds[lang];
    if (!Array.isArray(langEmbeds)) continue;

    for (const item of langEmbeds) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);

      // Incluimos todos los servidores, el frontend decidirá cuál usar
      servers.push({
        name: item.server === 'HLS' ? 'Zilla' : item.server,
        url: item.url,
        type: 'iframe',
      });
    }
  }

  return servers;
}
