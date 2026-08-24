import { fetchHtml } from "./fetchers";
import { getAnimeMetadata } from "./metadata";

// Función para extraer URLs de servidores de una respuesta (JSON o HTML plano)
function extractServersFromResponse(text: string): string[] {
  const servers: string[] = [];
  
  // Filtro para los dominios de servidores más importantes
  const filter = /(bysesukior|archive\.org|mega\.nz|ok\.ru|ytplay|abyssplayer|animed23\.online|\.mp4|\.m3u8)/i;

  // Intentar parsear como JSON (por si el options.php devuelve un objeto con URLs)
  try {
    const json = JSON.parse(text);
    const found = findUrlsInObject(json, filter);
    if (found.length) return found;
  } catch {
    // No es JSON, continuar con la búsqueda en texto
  }

  // Buscar URLs en texto plano (HTML o similar)
  const regex = /https?:\/\/[^\s"'<>]+/g;
  const matches = text.match(regex) || [];
  for (const url of matches) {
    if (filter.test(url) && !servers.includes(url)) {
      servers.push(url);
    }
  }

  return servers;
}

// Helper para buscar URLs recursivamente dentro de un objeto
function findUrlsInObject(obj: any, filter: RegExp): string[] {
  let results: string[] = [];
  if (typeof obj === 'string' && obj.startsWith('http') && filter.test(obj)) {
    return [obj];
  }
  if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      if (typeof obj[key] === 'string' && obj[key].startsWith('http')) {
        if (filter.test(obj[key])) results.push(obj[key]);
      } else if (typeof obj[key] === 'object') {
        results = results.concat(findUrlsInObject(obj[key], filter));
      }
    }
  }
  return results;
}

export async function getAnimeD23Servers(slug: string, episode: number): Promise<{ url: string, type: string }[]> {
  // 1. Obtener metadatos de AniList para generar variantes de títulos
  const meta = await getAnimeMetadata(slug);
  const allTitles = [slug, ...(meta.titles || [])];

  // 2. Generar variantes de slug (limpiando año, temporada, etc.)
  const variants = new Set<string>();
  for (const title of allTitles) {
    let clean = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    clean = clean.replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
    // Añadir el título limpio
    variants.add(clean);
    // Añadir variante sin año
    variants.add(clean.replace(/-\d{4}$/g, ""));
    // Añadir variante sin temporada
    variants.add(clean.replace(/-(temporada|season|t)-\d+$/g, ""));
  }

  // 3. Probar cada variante en la URL del capítulo
  for (const variant of variants) {
    const playerUrl = `https://animed23.com/capitulo/${variant}-ep-${episode}/`;
    const html = await fetchHtml(playerUrl);

    if (html) {
      // 4. Extraer la URL de options.php del iframe
      const optionsMatch = html.match(/https?:\/\/animed23\.(?:com|online)\/opciones\/options\.php\?server=multi&value=[^"'\s]+/);
      
      if (optionsMatch) {
        // 5. Llamar a options.php y extraer los servidores
        try {
          const response = await fetch(optionsMatch[0], {
            headers: getHeaders(optionsMatch[0])
          });
          const text = await response.text();
          const servers = extractServersFromResponse(text);
          
          if (servers.length) {
            // Si hay servidores, devolverlos
            return servers.map(url => ({ url, type: "Externo" }));
          }
        } catch (e) {
          console.error("Error fetching options.php", e);
        }
      }
    }
  }

  // Si no se encontró nada, devolver array vacío
  return [];
}

// Reutilizar getHeaders de fetchers
import { getHeaders } from "./fetchers";
