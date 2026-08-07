import { fetchHtml } from "./fetcher";

export interface AV1Server {
  name: string;
  url: string;
  type: "iframe";
}

// Extrae el objeto JSON que contiene "embeds" del HTML
function extractEmbedsJSON(html: string): any | null {
  const startMarker = '"embeds":';
  const startIndex = html.indexOf(startMarker);
  if (startIndex === -1) return null;

  // Retroceder hasta la primera '{' anterior a "embeds"
  let braceStart = startIndex;
  while (braceStart > 0 && html[braceStart] !== '{') {
    braceStart--;
  }
  if (html[braceStart] !== '{') return null;

  // Contar llaves para encontrar el cierre correspondiente
  let openCount = 0;
  let endIndex = braceStart;
  for (let i = braceStart; i < html.length; i++) {
    if (html[i] === '{') openCount++;
    else if (html[i] === '}') {
      openCount--;
      if (openCount === 0) {
        endIndex = i;
        break;
      }
    }
  }

  const jsonStr = html.substring(braceStart, endIndex + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export async function getAnimeAV1Servers(
  slug: string,
  episode: number
): Promise<AV1Server[]> {
  const url = `https://animeav1.com/media/${slug}/${episode}`;
  const html = await fetchHtml(url);
  if (!html) return [];

  const embedsObj = extractEmbedsJSON(html);
  if (!embedsObj?.embeds) return [];

  const servers: AV1Server[] = [];
  const seen = new Set<string>();

  // Procesar todos los idiomas (normalmente SUB)
  for (const lang of Object.keys(embedsObj.embeds)) {
    const langEmbeds = embedsObj.embeds[lang];
    if (!Array.isArray(langEmbeds)) continue;

    for (const item of langEmbeds) {
      // Incluir Zilla y UPNShare, evitar duplicados
      if (item.server === "HLS" || item.server === "UPNShare") {
        if (!item.url || seen.has(item.url)) continue;
        seen.add(item.url);
        servers.push({
          name: item.server === "HLS" ? "Zilla" : "UPNShare",
          url: item.url,
          type: "iframe",
        });
      }
    }
  }

  return servers;
}
