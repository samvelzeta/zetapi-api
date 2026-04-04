import { fetchHtml } from "./fetcher";

// ==============================
// 🔥 CACHE EN MEMORIA
// ==============================
const slugCache = new Map<string, string>();

// ==============================
// 🔥 NORMALIZAR TEXTO
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

      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// ==============================
// 🔥 SCORE INTELIGENTE
// ==============================
function scoreMatch(query: string, target: string): number {

  const q = normalize(query);
  const t = normalize(target);

  // coincidencia directa fuerte
  if (t.includes(q)) return 120;

  const distance = levenshtein(q, t);

  const maxLen = Math.max(q.length, t.length);

  const similarityScore = 100 - (distance / maxLen) * 100;

  // bonus por palabras en común
  const qWords = q.split(" ");
  const tWords = t.split(" ");

  let wordScore = 0;

  for (const w of qWords) {
    if (tWords.includes(w)) wordScore += 10;
  }

  return similarityScore + wordScore;
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
// 🔥 GENERAR VARIANTES INTERNAS
// ==============================
function generateSearchQueries(input: string): string[] {

  const base = normalize(input);

  const words = base.split(" ");

  const variants = new Set<string>();

  variants.add(base);

  // recortes progresivos
  for (let i = words.length; i > 1; i--) {
    variants.add(words.slice(0, i).join(" "));
  }

  // quitar palabras comunes
  variants.add(base.replace(/\b(the|no|of)\b/g, "").trim());

  // versiones compactas
  variants.add(words.join(""));
  variants.add(words.join("-"));

  return Array.from(variants).filter(v => v.length > 2);
}

// ==============================
// 🔥 BUSQUEDA PROGRESIVA REAL
// ==============================
export async function findJKAnimeSlug(query: string): Promise<string | null> {

  try {

    const key = normalize(query);

    // 🔥 CACHE
    if (slugCache.has(key)) {
      return slugCache.get(key)!;
    }

    const queries = generateSearchQueries(query);

    let bestSlug: string | null = null;
    let bestScore = 0;

    for (const q of queries) {

      const url = `https://jkanime.net/buscar/${encodeURIComponent(q)}`;
      const html = await fetchHtml(url);

      if (!html) continue;

      const results = extractResults(html);

      for (const r of results) {

        const score = scoreMatch(query, r.title);

        if (score > bestScore) {
          bestScore = score;
          bestSlug = r.slug;
        }
      }

      // 🔥 si encontramos uno muy bueno → parar
      if (bestScore > 140) break;
    }

    // 🔥 umbral mínimo
    if (!bestSlug || bestScore < 50) return null;

    // 🔥 GUARDAR CACHE
    slugCache.set(key, bestSlug);

    return bestSlug;

  } catch {
    return null;
  }
}
