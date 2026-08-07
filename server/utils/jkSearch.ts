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
  return 100 - (dist / maxLen) * 100;
}

async function searchJKAnime(query: string, originalTitle: string, threshold = 75): Promise<string | null> {
  let bestSlug: string | null = null;
  let bestScore = 0;

  for (let page = 1; page <= 2; page++) {
    const url = `https://jkanime.net/buscar/${encodeURIComponent(query)}/${page}/`;
    const html = await fetchHtml(url);
    if (!html) break;

    const results = extractResults(html);
    if (results.length === 0) break;

    for (const r of results) {
      const score = similarity(originalTitle, r.title);
      if (score > bestScore) {
        bestScore = score;
        bestSlug = r.slug;
        if (score >= 95) return bestSlug;
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
  if (typeof input === "string") {
    return findSlugByString(input, env, extraTitles);
  }

  const { slug, title } = input;
  const allTitles = [slug, title, ...(extraTitles || [])].filter(Boolean) as string[];

  for (const t of allTitles) {
    const found = await findSlugByString(t, env, allTitles);
    if (found) return found;
  }

  return null;
}

async function findSlugByString(
  input: string,
  env?: any,
  extraTitles?: string[]
): Promise<string | null> {
  const key = normalize(input);

  if (slugCache.has(key)) return slugCache.get(key)!;

  if (env?.SLUG_CACHE) {
    try {
      const cached = await env.SLUG_CACHE.get(key);
      if (cached) {
        slugCache.set(key, cached);
        return cached;
      }
    } catch {}
  }

  const words = key.split(" ").filter(w => w.length > 1);
  const queries = new Set<string>();
  queries.add(key);
  queries.add(words.join("-"));
  queries.add(words.join(""));
  for (let i = words.length; i > 1; i--) {
    queries.add(words.slice(0, i).join(" "));
    queries.add(words.slice(0, i).join("-"));
  }

  const found = await searchJKAnime(Array.from(queries).join(" "), key, 75);

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
