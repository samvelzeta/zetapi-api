import { fetchHtml } from "./fetcher";

export interface AnimeX2Server {
  name: string;
  url: string;
  type: "embed" | "download";
  language: string;
}

/**
 * Parsea el valor serializado de Astro (ej. [0, "HLS"] → "HLS", [1, 42] → 42)
 */
function parseAstroValue(raw: any): any {
  if (!Array.isArray(raw) || raw.length !== 2) {
    return raw; // ya es un valor plano (objeto, etc.)
  }
  const [type, value] = raw;
  switch (type) {
    case 0: return value;                  // string
    case 1: return value;                  // number
    case 2: return value;                  // boolean
    case 7: return value;                  // string (URL)
    // otros tipos se devuelven tal cual
    default: return value;
  }
}

/**
 * Extrae las props del componente VideoPlayer de Astro.
 * Devuelve un objeto con los servidores listos para usar.
 */
function parseVideoPlayerProps(html: string): any | null {
  // Buscar el astro-island del VideoPlayer
  const regex = /<astro-island[^>]*component-url="[^"]*VideoPlayer[^"]*"[^>]*props="([^"]*)"[^>]*>/i;
  const match = html.match(regex);
  if (!match) return null;

  // Decodificar entidades HTML (&quot; → ")
  const encodedProps = match[1]
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  let propsObj: any;
  try {
    propsObj = JSON.parse(encodedProps);
  } catch (e) {
    console.error("❌ Animex2: Error al parsear props JSON", e);
    return null;
  }

  // Las props tienen la forma { "clave": [tipo, valor] }
  const result: any = {};
  for (const key of Object.keys(propsObj)) {
    result[key] = parseAstroValue(propsObj[key]);
  }

  return result;
}

/**
 * Obtiene los servidores de un episodio de Animex2.
 * @param slug - El slug del anime (ej. "tensei-shitara-slime-datta-ken-4th-season")
 * @param episode - Número de episodio
 * @returns Lista de servidores de tipo embed (solo los que sirven para reproducir)
 */
export async function getAnimeX2Servers(
  slug: string,
  episode: number
): Promise<AnimeX2Server[]> {
  const url = `https://animex2.com/ver/${slug}-${episode}`;
  console.log("🔍 Animex2:", url);

  const html = await fetchHtml(url);
  if (!html) {
    console.log("❌ Animex2: HTML vacío");
    return [];
  }

  const props = parseVideoPlayerProps(html);
  if (!props || !Array.isArray(props.servers)) {
    console.log("❌ Animex2: No se encontraron servidores en las props");
    return [];
  }

  // Cada servidor es un objeto con campos tipo [tipo, valor]
  const servers: AnimeX2Server[] = [];
  for (const rawServer of props.servers) {
    const name = parseAstroValue(rawServer.name);
    const urlVal = parseAstroValue(rawServer.url);
    const type = parseAstroValue(rawServer.type);
    const language = parseAstroValue(rawServer.language) || "SUB";

    if (type !== "embed") continue; // solo queremos embeds

    servers.push({
      name,
      url: urlVal,
      type,
      language,
    });
  }

  console.log(`🎯 Animex2: ${servers.length} servidores embed encontrados`);
  return servers;
}
