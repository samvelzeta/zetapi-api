import { fetchHtml } from "./fetcher";

// ==============================
// 🔥 KV CACHE + MEMORIA
// ==============================
const memoryCache = new Map<string, string>();

// ==============================
// 🔥 NORMALIZAR
// ==============================
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_:]/g, " ")
    .replace(/\b(tv|season|temporada|part|parte|capitulo|episode)\b/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ==============================
// 🔥 LEVENSHTEIN
// ==============================
function levenshtein(a: string, b: string): number {
  const matrix = [];

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

// ==============================
// 🔥 SCORE REAL (UMBRAL 85%)
// ==============================
function similarity(query: string, target: string): number {
  const q = normalize(query);
  const t = normalize(target);

  const distance = levenshtein(q, t);
  const maxLen = Math.max(q.length, t.length);

  return 100 - (distance / maxLen) * 100;
}

// ==============================
// 🔥 EXTRAER RESULTADOS
// ==============================
function extractResults(html: string) {
  const results: { slug: string; title: string }[] = [];

  const matches = [
    ...html.matchAll(/href="\/anime\/([^"]+)".*?title="([^"]+)"/g)
  ];

  for (const m of matches) {
    results.push({
      slug: m[1],
      title: m[2]
    });
  }

  return results;
}

// ==============================
// 🔥 QUERIES PROGRESIVAS
// ==============================
function generateQueries(input: string): string[] {
  const base = normalize(input);
  const words = base.split(" ");

  const set = new Set<string>();

  set.add(base);
  set.add(words.join("-"));
  set.add(words.join(""));

  for (let i = words.length; i > 1; i--) {
    set.add(words.slice(0, i).join(" "));
  }

  return Array.from(set);
}

// ==============================
// 🔥 MAIN
// ==============================
export async function findJKAnimeSlug(query: string, env?: any): Promise<string | null> {

  const key = normalize(query);

  // ======================
  // 🧠 MEMORY CACHE
  // ======================
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!;
  }

  // ======================
  // ☁️ KV CACHE
  // ======================
  if (env?.SLUG_CACHE) {
    const cached = await env.SLUG_CACHE.get(key);
    if (cached) {
      memoryCache.set(key, cached);
      return cached;
    }
  }

  const queries = generateQueries(query);

  let bestSlug: string | null = null;
  let bestScore = 0;

  for (const q of queries) {

    const url = `https://jkanime.net/buscar/${encodeURIComponent(q)}`;
    const html = await fetchHtml(url);

    if (!html) continue;

    const results = extractResults(html);

    for (const r of results) {

      const score = similarity(query, r.title);

      if (score > bestScore) {
        bestScore = score;
        bestSlug = r.slug;
      }
    }
  }

  // ======================
  // 🔥 UMBRAL REAL
  // ======================
  if (!bestSlug || bestScore < 85) return null;

  // ======================
  // 💾 GUARDAR CACHE
  // ======================
  memoryCache.set(key, bestSlug);

  if (env?.SLUG_CACHE) {
    await env.SLUG_CACHE.put(key, bestSlug);
  }

  return bestSlug;
}
