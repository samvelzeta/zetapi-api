import { fetchHtml } from "./fetcher";

// Cache en memoria para el mapeo slug -> jkanime slug
const slugCache = new Map<string, string>();

// ======================
// OBTENER TÍTULOS ALTERNATIVOS DESDE ANILIST
// ======================
async function getAniListTitles(anilistId: number): Promise<string[]> {
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query ($id: Int) { Media(id: $id, type: ANIME) { title { romaji english native } synonyms } }`,
        variables: { id: anilistId },
      }),
    });
    const json = await res.json();
    const media = json?.data?.Media;
    if (!media) return [];
    return [
      media.title?.romaji,
      media.title?.english,
      media.title?.native,
      ...(media.synonyms || []),
    ].filter(Boolean);
  } catch {
    return [];
  }
}

// ======================
// NORMALIZAR TEXTO
// ======================
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ======================
// DISTANCIA LEVENSHTEIN
// ======================
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

function similarity(a: string, b: string): number {
  const dist = levenshtein(normalize(a), normalize(b));
  const maxLen = Math.max(a.length, b.length);
  return 100 - (dist / maxLen) * 100;
}

// ======================
// EXTRAER RESULTADOS DE LA PÁGINA DE BÚSQUEDA
// ======================
function extractResults(html: string): { slug: string; title: string }[] {
  const results: { slug: string; title: string }[] = [];
  // regex para enlaces de animes: /anime/... o directamente en href
  const regex = /href="\/([^"]+)"[^>]*title="([^"]+)"/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    if (m[1].startsWith("anime/")) {
      results.push({ slug: m[1].replace("anime/", ""), title: m[2] });
    }
  }
  return results;
}

// ======================
// BUSCAR EN JKANIME CON MÚLTIPLES QUERIES Y PÁGINAS
// ======================
async function searchJKAnime(
  queries: string[],
  originalTitle: string,
  threshold = 75
): Promise<string | null> {
  const tried = new Set<string>();
  let bestSlug: string | null = null;
  let bestScore = 0;

  for (const query of queries) {
    if (tried.has(query)) continue;
    tried.add(query);

    // Buscar en varias páginas (hasta 3 para cubrir más resultados)
    for (let page = 1; page <= 3; page++) {
      const url = `https://jkanime.net/buscar/${encodeURIComponent(query)}/${page}/`;
      const html = await fetchHtml(url);
      if (!html) break;

      const results = extractResults(html);
      if (results.length === 0) break; // si no hay resultados, no sigue páginas

      for (const r of results) {
        const score = similarity(originalTitle, r.title);
        if (score > bestScore) {
          bestScore = score;
          bestSlug = r.slug;
          if (score >= 95) return bestSlug; // perfecto
        }
      }
    }
  }

  return bestScore >= threshold ? bestSlug : null;
}

// ======================
// FUNCIÓN PRINCIPAL: ENCONTRAR SLUG DE JKANIME A PARTIR DE SLUG/TÍTULO DE ANILIST
// ======================
export async function findJKAnimeSlug(
  input: string | { slug?: string; title?: string; anilistId?: number },
  env?: any
): Promise<string | null> {
  // Si es string, lo tratamos como slug/título simple
  if (typeof input === "string") {
    return findSlugByString(input, env);
  }

  // Si es objeto, usamos toda la info disponible
  const { slug, title, anilistId } = input;

  // Primero, intentar con el slug directo y sus variantes
  if (slug) {
    const direct = await findSlugByString(slug, env);
    if (direct) return direct;
  }

  // Segundo, con el título
  if (title) {
    const byTitle = await findSlugByString(title, env);
    if (byTitle) return byTitle;
  }

  // Tercero, si tenemos anilistId, obtener todos los títulos y buscar cada uno
  if (anilistId) {
    const titles = await getAniListTitles(anilistId);
    for (const t of titles) {
      const found = await findSlugByString(t, env);
      if (found) return found;
    }
  }

  return null;
}

// ----------------------------
// Búsqueda por string (con caché KV y memoria)
// ----------------------------
async function findSlugByString(
  input: string,
  env?: any
): Promise<string | null> {
  const key = normalize(input);

  // 1. Memoria
  if (slugCache.has(key)) return slugCache.get(key)!;

  // 2. KV (si existe)
  if (env?.SLUG_CACHE) {
    try {
      const cached = await env.SLUG_CACHE.get(key);
      if (cached) {
        slugCache.set(key, cached);
        return cached;
      }
    } catch {}
  }

  // 3. Generar queries (el texto original y variantes sin espacios, con guiones, etc.)
  const words = key.split(" ").filter(w => w.length > 1);
  const queries = new Set<string>();
  queries.add(key);
  queries.add(words.join("-"));
  queries.add(words.join(""));
  // añadir versiones cortas
  for (let i = words.length; i > 1; i--) {
    queries.add(words.slice(0, i).join(" "));
    queries.add(words.slice(0, i).join("-"));
  }

  const found = await searchJKAnime(Array.from(queries), key, 75);

  if (found) {
    slugCache.set(key, found);
    if (env?.SLUG_CACHE) {
      try {
        await env.SLUG_CACHE.put(key, found);
      } catch {}
    }
    return found;
  }

  return null;
}
