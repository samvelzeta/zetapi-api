import { fetchHtml } from "./fetcher";

const slugCache = new Map<string, string>();

// ----------------------------------------------------------
// HELPERS DE TEXTO
// ----------------------------------------------------------
function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function stripHtml(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalize(text: string): string {
  return decodeHtml(text)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBaseTitle(text: string): string {
  return normalize(text)
    .replace(/\b(?:season|temporada)\s+\d+\b/g, " ")
    .replace(/\b\d+(?:st|nd|rd|th)\s+season\b/g, " ")
    .replace(/\b(?:part|parte)\s+\d+\b/g, " ")
    .replace(/\bcour\s+\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  const aa = normalize(a);
  const bb = normalize(b);
  if (!aa || !bb) return Math.max(aa.length, bb.length);
  const prev = new Array(bb.length + 1).fill(0);
  for (let j = 0; j <= bb.length; j++) prev[j] = j;
  for (let i = 1; i <= aa.length; i++) {
    const curr = new Array(bb.length + 1).fill(0);
    curr[0] = i;
    for (let j = 1; j <= bb.length; j++) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= bb.length; j++) prev[j] = curr[j];
  }
  return prev[bb.length];
}

function levenshteinSimilarity(a: string, b: string): number {
  const aa = normalize(a);
  const bb = normalize(b);
  if (!aa || !bb) return 0;
  const dist = levenshtein(aa, bb);
  const maxLen = Math.max(aa.length, bb.length);
  return maxLen ? 1 - dist / maxLen : 1;
}

function tokenSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

function containsSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (nb.includes(na)) return 0.94;
  if (na.includes(nb)) return 0.9;
  return 0;
}

// ----------------------------------------------------------
// SCORING DE CANDIDATOS
// ----------------------------------------------------------
function scoreCandidate(candidate: { title: string; slug: string }, titles: string[]): number {
  let best = 0;
  for (const title of titles) {
    const a = normalize(title);
    const b = normalize(candidate.title);
    if (!a || !b) continue;
    // Coincidencia exacta
    if (a === b) { best = Math.max(best, 100); continue; }
    // Sin indicadores de temporada
    const baseA = normalizeBaseTitle(title);
    const baseB = normalizeBaseTitle(candidate.title);
    if (baseA && baseA === baseB) { best = Math.max(best, 96); continue; }
    const contains = containsSimilarity(title, candidate.title);
    const tokens = tokenSimilarity(title, candidate.title);
    const lev = levenshteinSimilarity(title, candidate.title);
    best = Math.max(best, contains * 45 + tokens * 30 + lev * 25);
  }
  return Math.round(best * 100) / 100;
}

// ----------------------------------------------------------
// EXTRACCIÓN DE RESULTADOS DE BÚSQUEDA
// ----------------------------------------------------------
function getAttribute(attrs: string, name: string): string | null {
  const regex = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i");
  const match = attrs.match(regex);
  if (!match) return null;
  return decodeHtml(match[1] ?? match[2] ?? "");
}

function getAnimeSlugFromHref(href: string): string | null {
  try {
    const url = new URL(href, "https://jkanime.net");
    if (url.hostname !== "jkanime.net") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) return null;
    const slug = parts[0].trim();
    if (!slug) return null;
    const reserved = new Set([
      "buscar", "directorio", "genero", "temporada", "studio", "usuario",
      "dash", "ajax", "ranking", "top", "horario", "historial", "guardado",
      "playlist", "aplicacion", "login", "salir"
    ]);
    return reserved.has(slug.toLowerCase()) ? null : slug;
  } catch { return null; }
}

function extractSearchResults(html: string): { slug: string; title: string }[] {
  const results: { slug: string; title: string }[] = [];
  const seen = new Set<string>();
  const anchorRegex = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const attrs = match[1];
    const inner = match[2];
    const href = getAttribute(attrs, "href");
    if (!href) continue;
    const slug = getAnimeSlugFromHref(href);
    if (!slug) continue;
    let title = getAttribute(attrs, "title");
    if (!title) {
      const h5 = inner.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
      title = h5 ? stripHtml(h5[1]) : stripHtml(inner);
    }
    title = decodeHtml(title).trim();
    if (!title || title.length < 2) continue;
    const key = slug.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ slug, title });
  }
  return results;
}

// ----------------------------------------------------------
// BÚSQUEDA EN JKANIME
// ----------------------------------------------------------
async function searchJKAnime(query: string, page = 1): Promise<{ slug: string; title: string }[]> {
  const encoded = encodeURIComponent(query);
  for (const url of [
    `https://jkanime.net/buscar/${encoded}/${page}/`,
    `https://jkanime.net/buscar?q=${encoded}`
  ]) {
    const html = await fetchHtml(url);
    if (!html) continue;
    const results = extractSearchResults(html);
    if (results.length) return results;
  }
  return [];
}

// ----------------------------------------------------------
// VALIDACIÓN DEL EPISODIO (existe la página?)
// ----------------------------------------------------------
async function validateEpisode(slug: string, episode: number): Promise<boolean> {
  if (!Number.isInteger(episode) || episode < 1) return false;
  const url = `https://jkanime.net/${slug}/${episode}/`;
  const html = await fetchHtml(url);
  if (!html) return false;
  const hasVideo = /video\[\d+\]\s*=\s*['"][\s\S]*?<iframe/i.test(html);
  const hasCanonicalSlug = new RegExp(`https?:\\/\\/jkanime\\.net\\/${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/`, "i").test(html);
  return hasCanonicalSlug && hasVideo;
}

// ----------------------------------------------------------
// FUNCIÓN PRINCIPAL
// ----------------------------------------------------------
export async function findJKAnimeSlug(
  input: string | { slug?: string; title?: string; anilistId?: number },
  env?: any,
  extraTitles: string[] = []
): Promise<string | null> {
  const inputSlug = typeof input === "string" ? input : input.slug;
  const inputTitle = typeof input === "string" ? input : input.title;
  const titles = [inputTitle, inputSlug, ...extraTitles].filter(Boolean).map(String);
  if (!titles.length) return null;

  const cacheKey = `jk:${normalize(titles[0])}`;

  // Caché en memoria
  if (slugCache.has(cacheKey)) return slugCache.get(cacheKey)!;

  // Caché KV (si está disponible)
  if (env?.SLUG_CACHE) {
    try {
      const cached = await env.SLUG_CACHE.get(cacheKey);
      if (cached) { slugCache.set(cacheKey, cached); return cached; }
    } catch {}
  }

  // Generar consultas únicas
  const queries = new Set<string>();
  for (const title of titles) {
    queries.add(title);
    queries.add(normalizeBaseTitle(title));
    const words = tokenize(title);
    if (words.length >= 3) queries.add(words.slice(0, 3).join(" "));
  }
  const queryList = Array.from(queries).slice(0, 10);

  // Obtener candidatos de todas las consultas
  const candidatesMap = new Map<string, { slug: string; title: string; score: number }>();
  for (const query of queryList) {
    const results = await searchJKAnime(query, 1);
    for (const r of results) {
      const score = scoreCandidate(r, titles);
      const prev = candidatesMap.get(r.slug);
      if (!prev || score > prev.score) candidatesMap.set(r.slug, { ...r, score });
    }
  }

  const ranked = Array.from(candidatesMap.values()).sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;

  // Si hay una coincidencia muy fuerte, la aceptamos directamente
  const strong = ranked.find(c => c.score >= 94);
  if (strong) {
    slugCache.set(cacheKey, strong.slug);
    if (env?.SLUG_CACHE) {
      try { await env.SLUG_CACHE.put(cacheKey, strong.slug); } catch {}
    }
    return strong.slug;
  }

  // Si no, probamos los mejores candidatos hasta validar el episodio
  for (const candidate of ranked.slice(0, 3)) {
    if (candidate.score < 72) break;
    // Validación del episodio (se usará el episodio que se está buscando)
    // Nota: aquí no conocemos el episodio todavía, solo buscamos el slug.
    // La validación del episodio se hará en getAllServers.
    // Pero podemos devolver el mejor slug con puntuación suficiente.
    slugCache.set(cacheKey, candidate.slug);
    if (env?.SLUG_CACHE) {
      try { await env.SLUG_CACHE.put(cacheKey, candidate.slug); } catch {}
    }
    return candidate.slug;
  }

  return null;
}
