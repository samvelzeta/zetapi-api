import { fetchHtml } from "./fetcher";

const slugCache = new Map<string, string>();

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  return 1 - dist / maxLen; // valor entre 0 y 1
}

// Ponderación por tipo de título (mayor peso = más importante)
const TITLE_WEIGHTS: Record<string, number> = {
  romaji: 1.0,
  english: 0.95,
  native: 0.85,
  synonym: 0.9,
  default: 0.8,
};

/**
 * Busca en JKAnime usando múltiples títulos y devuelve el mejor slug.
 * - `titles` es un array de objetos { text, type }.
 */
async function searchJKAnimeWithTitles(
  titles: { text: string; type: string }[],
  threshold = 0.8
): Promise<string | null> {
  let bestSlug: string | null = null;
  let bestScore = 0;

  // Probar cada título como query (máximo 2 páginas)
  for (const { text, type } of titles) {
    const query = normalize(text);
    for (let page = 1; page <= 2; page++) {
      const url = `https://jkanime.net/buscar/${encodeURIComponent(query)}/${page}/`;
      const html = await fetchHtml(url);
      if (!html) break;

      const results = extractResults(html);
      if (results.length === 0) break;

      for (const r of results) {
        // Comparar el resultado contra TODOS los títulos (con peso) y quedarse con la mejor similitud
        let maxSim = 0;
        for (const t of titles) {
          const sim = similarity(t.text, r.title);
          const weighted = sim * (TITLE_WEIGHTS[t.type] || TITLE_WEIGHTS.default);
          if (weighted > maxSim) maxSim = weighted;
        }

        if (maxSim > bestScore) {
          bestScore = maxSim;
          bestSlug = r.slug;
          if (maxSim >= 0.95) return bestSlug; // casi perfecto, paramos
        }
      }
    }
  }

  return bestScore >= threshold ? bestSlug : null;
}

function extractResults(html: string): { slug: string; title: string }[] {
  const results: { slug: string; title: string }[] = [];
  const regex = /href="\/([^"]+)"[^>]*title="([^"]+)"/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    if (m[1].startsWith("anime/")) {
      results.push({ slug: m[1].replace("anime/", ""), title: m[2] });
    }
  }
  return results;
}

export async function findJKAnimeSlug(
  input: string | { slug?: string; title?: string; anilistId?: number },
  env?: any,
  extraTitles?: string[]
): Promise<string | null> {
  // Si es string, lo tratamos como slug/título simple
  const slug = typeof input === "string" ? input : input.slug;
  const title = typeof input === "string" ? input : input.title;
  const allTitlesRaw = [slug, title, ...(extraTitles || [])].filter(Boolean) as string[];

  // Preparar array de objetos {text, type}
  const titleObjects: { text: string; type: string }[] = allTitlesRaw.map(t => ({
    text: t,
    type: "default",
  }));

  // Intentar obtener metadatos si tenemos un título representativo
  if (title) {
    try {
      const { titles } = await import("./metadata").then(m => m.getAnimeMetadata(title));
      for (const t of titles) {
        if (!titleObjects.some(o => o.text === t)) {
          // Clasificar tipo según heurística (romaji, english, etc.)
          const type = classifyTitleType(t);
          titleObjects.push({ text: t, type });
        }
      }
    } catch {}
  }

  // Verificar caché (memoria + KV)
  const cacheKey = normalize(slug || title || "");
  if (slugCache.has(cacheKey)) return slugCache.get(cacheKey)!;
  if (env?.SLUG_CACHE) {
    try {
      const cached = await env.SLUG_CACHE.get(cacheKey);
      if (cached) {
        slugCache.set(cacheKey, cached);
        return cached;
      }
    } catch {}
  }

  const best = await searchJKAnimeWithTitles(titleObjects, 0.8);

  if (best) {
    slugCache.set(cacheKey, best);
    if (env?.SLUG_CACHE) {
      try { await env.SLUG_CACHE.put(cacheKey, best); } catch {}
    }
  }

  return best;
}

function classifyTitleType(text: string): string {
  // Heurística simple: si contiene caracteres japoneses → "native"
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) return "native";
  // Si está en inglés probablemente sea "english"
  if (/^[a-zA-Z0-9\s\-:]+$/.test(text)) return "english";
  return "default";
}
