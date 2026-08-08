import { fetchHtml } from "./fetcher";
import { matchScore } from "./titleMatcher";

const memoryCache = new Map<string, string>();

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Genera muchas variantes de búsqueda: título limpio, sin temporadas, versiones cortas…
 */
function generateQueries(input: string, allTitles: string[]): string[] {
  const base = normalize(input);
  const words = base.split(" ").filter(w => w.length > 1);
  const queries = new Set<string>();

  // La consulta original
  queries.add(base);

  // Sin números de temporada, part, cour, etc.
  const noSeason = base
    .replace(/\b(season|temporada|part|parte|cour)\s*\d+\b/gi, "")
    .replace(/\b\d+(st|nd|rd|th)\s*(season|temporada)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (noSeason && noSeason !== base) queries.add(noSeason);

  // Solo las primeras palabras (2,3,4)
  for (let i = 2; i <= Math.min(4, words.length); i++) {
    queries.add(words.slice(0, i).join(" "));
  }

  // También los otros títulos (english, synonyms) sin duplicar
  for (const t of allTitles) {
    const n = normalize(t);
    if (n && n !== base) queries.add(n);
    // Versión sin temporada de cada título alternativo
    const ns = n
      .replace(/\b(season|temporada|part|parte|cour)\s*\d+\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (ns && ns !== n) queries.add(ns);
  }

  return Array.from(queries).slice(0, 12); // máximo 12 consultas
}

function extractResults(html: string) {
  const results: { slug: string; title: string }[] = [];
  const regex = /<a\b[^>]*href\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const href = m[1];
    const slugMatch = href.match(/(?:https?:\/\/jkanime\.net)?\/([^/?#"']+)\/?/i);
    if (!slugMatch) continue;
    const slug = slugMatch[1];
    // Ignorar rutas que claramente no son animes
    if (/^(buscar|directorio|genero|temporada|studio|usuario|dash|ajax|ranking|top|horario|historial|guardado|playlist|aplicacion|login|salir)$/i.test(slug)) continue;
    const title = m[2].replace(/<[^>]+>/g, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
    if (title.length < 2) continue;
    results.push({ slug, title });
  }
  // Deduplicar por slug
  const unique = new Map<string, { slug: string; title: string }>();
  for (const r of results) if (!unique.has(r.slug)) unique.set(r.slug, r);
  return Array.from(unique.values());
}

export async function findJKAnimeSlug(
  query: string,
  env?: any,
  allTitles: string[] = [],
  malId: number | null = null
): Promise<string | null> {
  const key = normalize(query);
  if (memoryCache.has(key)) return memoryCache.get(key)!;

  if (env?.SLUG_CACHE) {
    const cached = await env.SLUG_CACHE.get(key);
    if (cached) {
      memoryCache.set(key, cached);
      return cached;
    }
  }

  const queries = generateQueries(query, allTitles);
  const candidates = new Map<string, { slug: string; title: string; score: number }>();

  for (const q of queries) {
    const url = `https://jkanime.net/buscar/${encodeURIComponent(q)}/1/`;
    const html = await fetchHtml(url);
    if (!html) continue;
    const results = extractResults(html);
    for (const r of results) {
      // Usar el motor de puntuación avanzado (sin MAL ID porque JKAnime no lo expone en el listado)
      const score = matchScore(r.title, r.slug, null, allTitles, malId);
      const prev = candidates.get(r.slug);
      if (!prev || score > prev.score) {
        candidates.set(r.slug, { ...r, score });
      }
    }
  }

  if (candidates.size === 0) return null;

  // Ordenar por puntuación descendente
  const ranked = Array.from(candidates.values()).sort((a, b) => b.score - a.score);

  // Elegir el mejor con score >= 72 (antes era 85)
  const best = ranked[0];
  if (best.score < 72) return null;

  memoryCache.set(key, best.slug);
  if (env?.SLUG_CACHE) await env.SLUG_CACHE.put(key, best.slug);

  return best.slug;
}
