function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(x => x.length > 1);
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

function levenshteinSimilarity(a: string, b: string): number {
  a = normalize(a);
  b = normalize(b);
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

function tokenSimilarity(a: string, b: string): number {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const token of A) if (B.has(token)) common++;
  return common / Math.max(A.size, B.size);
}

export function matchScore(
  candidateTitle: string,
  candidateSlug: string,
  candidateMalId: number | null,
  queryTitles: string[],
  queryMalId: number | null
): number {
  let best = 0;

  // MAL ID exacto → puntuación máxima
  if (candidateMalId && queryMalId && candidateMalId === queryMalId) {
    return 100;
  }

  for (const queryTitle of queryTitles) {
    const q = normalize(queryTitle);
    const c = normalize(candidateTitle);
    if (!q || !c) continue;

    if (q === c) { best = Math.max(best, 95); continue; }

    // Coincidencia parcial (uno contiene al otro)
    if (c.includes(q)) best = Math.max(best, 90);
    else if (q.includes(c)) best = Math.max(best, 85);

    const lev = levenshteinSimilarity(q, c);
    const tok = tokenSimilarity(q, c);
    best = Math.max(best, lev * 50 + tok * 50);
  }

  // Bonus por slug (el slug suele ser el título normalizado)
  if (candidateSlug) {
    const slugTitle = candidateSlug.replace(/-/g, " ");
    best = Math.max(best, matchScore(slugTitle, "", null, queryTitles, null) * 0.9);
  }

  return Math.min(100, best);
}
