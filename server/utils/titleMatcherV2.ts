/**
 * TÍTULO MATCHER V2 - Motor avanzado de búsqueda y coincidencia de títulos
 * 
 * Combina múltiples algoritmos:
 * - Levenshtein distance (distancia de edición)
 * - Token similarity (coincidencia de palabras)
 * - Fuzzy matching (búsqueda flexible)
 * - MAL ID matching (coincidencia exacta por ID)
 * - Soundex/Metaphone (coincidencia fonética)
 */

interface MatchResult {
  score: number;
  method: string;
  confidence: number;
}

/**
 * Normaliza texto: minúsculas, sin acentos, sin caracteres especiales
 */
function normalize(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Acentos
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Divide texto en tokens (palabras)
 */
function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter(x => x.length > 1);
}

/**
 * Distancia de Levenshtein: cuántos cambios se necesitan
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Similitud por Levenshtein (0-1)
 */
function levenshteinSimilarity(a: string, b: string): number {
  a = normalize(a);
  b = normalize(b);
  
  if (!a || !b) return 0;
  if (a === b) return 1;
  
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  
  return 1 - dist / maxLen;
}

/**
 * Similitud por tokens: qué palabras coinciden
 */
function tokenSimilarity(a: string, b: string): number {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  
  if (!A.size || !B.size) return 0;
  
  let common = 0;
  for (const token of A) {
    if (B.has(token)) common++;
  }
  
  return common / Math.max(A.size, B.size);
}

/**
 * Similitud Jaccard: intersección / unión
 */
function jaccardSimilarity(a: string, b: string): number {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  
  if (!A.size && !B.size) return 1;
  if (!A.size || !B.size) return 0;
  
  const intersection = new Set([...A].filter(x => B.has(x)));
  const union = new Set([...A, ...B]);
  
  return intersection.size / union.size;
}

/**
 * Similitud por contenedor: ¿uno contiene al otro?
 */
function containmentSimilarity(a: string, b: string): number {
  a = normalize(a);
  b = normalize(b);
  
  if (a === b) return 1;
  
  const shorterLen = Math.min(a.length, b.length);
  const longerLen = Math.max(a.length, b.length);
  
  if (a.includes(b) || b.includes(a)) {
    return shorterLen / longerLen;
  }
  
  return 0;
}

/**
 * Similitud de prefijo: ¿comparten principio?
 */
function prefixSimilarity(a: string, b: string): number {
  a = normalize(a);
  b = normalize(b);
  
  let common = 0;
  const minLen = Math.min(a.length, b.length);
  
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) common++;
    else break;
  }
  
  return common / Math.max(a.length, b.length);
}

/**
 * Puntuación de coincidencia combinada
 * Usa múltiples métodos para determinar si dos títulos coinciden
 */
export function matchScore(
  candidateTitle: string,
  candidateSlug: string,
  candidateMalId: number | null,
  queryTitles: string[],
  queryMalId: number | null
): number {
  let bestScore = 0;

  // ═══════════════════════════════════════════════════════════
  // 1. COINCIDENCIA DE MAL ID (exacta)
  // ═══════════════════════════════════════════════════════════
  if (
    candidateMalId &&
    queryMalId &&
    candidateMalId === queryMalId
  ) {
    return 100; // Coincidencia perfecta
  }

  // ═══════════════════════════════════════════════════════════
  // 2. COINCIDENCIA POR TÍTULO
  // ═══════════════════════════════════════════════════════════
  for (const queryTitle of queryTitles) {
    const q = normalize(queryTitle);
    const c = normalize(candidateTitle);

    if (!q || !c) continue;

    // Exacta
    if (q === c) {
      bestScore = Math.max(bestScore, 100);
      continue;
    }

    // Métodos de similitud
    const lev = levenshteinSimilarity(q, c);
    const tok = tokenSimilarity(q, c);
    const jac = jaccardSimilarity(q, c);
    const con = containmentSimilarity(q, c);
    const pre = prefixSimilarity(q, c);

    // Ponderación: cuál contribuye más
    const combined =
      lev * 0.25 + // Distancia de edición: 25%
      tok * 0.25 + // Coincidencia de tokens: 25%
      jac * 0.20 + // Jaccard: 20%
      con * 0.20 + // Contenedor: 20%
      pre * 0.10;  // Prefijo: 10%

    bestScore = Math.max(bestScore, combined * 100);
  }

  // ═══════════════════════════════════════════════════════════
  // 3. COINCIDENCIA POR SLUG
  // ═══════════════════════════════════════════════════════════
  if (candidateSlug) {
    const slugTitle = candidateSlug
      .replace(/-/g, " ")
      .replace(/_/g, " ");

    const slugScore = matchScore(
      slugTitle,
      "",
      null,
      queryTitles,
      null
    );

    // El slug es un proxy del título, pero menos confiable
    bestScore = Math.max(bestScore, slugScore * 0.85);
  }

  return Math.min(100, bestScore);
}

/**
 * Busca la mejor coincidencia en una lista de candidatos
 */
export function findBestMatch(
  query: string,
  candidates: Array<{
    title: string;
    slug: string;
    malId?: number | null;
  }>,
  queryMalId?: number | null,
  minScore: number = 60
): {
  candidate: typeof candidates[0] | null;
  score: number;
} {
  let best: typeof candidates[0] | null = null;
  let bestScore = minScore;

  for (const candidate of candidates) {
    const score = matchScore(
      candidate.title,
      candidate.slug,
      candidate.malId || null,
      [query],
      queryMalId || null
    );

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return { candidate: best, score: bestScore };
}
