import { fetchHtml } from "./fetcher";

const JK_BASE = "https://jkanime.net";

// ======================================================
// TIPOS
// ======================================================
export interface JKSearchResult {
  title: string;
  slug: string;
  url: string;
  score?: number;
}

export interface JKServer {
  name: string;
  url: string;
  type: "iframe";
}

// ======================================================
// NORMALIZACIÓN
// ======================================================
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
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
  if (a === b) return 1;
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

function titleScore(query: string, result: string): number {
  const q = normalize(query);
  const r = normalize(result);
  if (!q || !r) return 0;
  if (q === r) return 1;
  if (r.includes(q)) {
    const ratio = q.length / r.length;
    return 0.82 + ratio * 0.15;
  }
  if (q.includes(r)) {
    const ratio = r.length / q.length;
    return 0.75 + ratio * 0.15;
  }
  const lev = levenshteinSimilarity(q, r);
  const tok = tokenSimilarity(q, r);
  return lev * 0.45 + tok * 0.55;
}

// ======================================================
// EXTRACCIÓN DE RESULTADOS DE BÚSQUEDA
// ======================================================
function extractSearchResults(html: string): JKSearchResult[] {
  const results: JKSearchResult[] = [];
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href) continue;
    const slugMatch = href.match(/(?:https?:\/\/jkanime\.net)?\/([^/?#"']+)\/?/i);
    if (!slugMatch) continue;
    const slug = slugMatch[1];
    const title = match[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!title || title.length < 2) continue;
    results.push({ title, slug, url: `${JK_BASE}/${slug}/` });
  }
  // Deduplicar
  const unique = new Map<string, JKSearchResult>();
  for (const r of results) if (!unique.has(r.slug)) unique.set(r.slug, r);
  return Array.from(unique.values());
}

// ======================================================
// BÚSQUEDA EN JKANIME
// ======================================================
export async function searchJKAnime(query: string): Promise<JKSearchResult[]> {
  const clean = normalize(query);
  if (!clean) return [];
  const candidates: JKSearchResult[] = [];
  for (let page = 1; page <= 2; page++) {
    const url = `${JK_BASE}/buscar/${encodeURIComponent(clean)}/${page}/`;
    console.log("🔎 JKAnime SEARCH:", url);
    const html = await fetchHtml(url);
    if (!html) { console.log("❌ JKAnime search sin HTML:", page); continue; }
    const results = extractSearchResults(html);
    console.log(`🔎 JKAnime resultados página ${page}:`, results.length);
    candidates.push(...results);
    if (results.length === 0) break;
  }
  const map = new Map<string, JKSearchResult>();
  for (const item of candidates) if (!map.has(item.slug)) map.set(item.slug, item);
  return Array.from(map.values());
}

// ======================================================
// VALIDACIÓN DE CANDIDATO (VISITANDO LA PÁGINA)
// ======================================================
async function inspectJKAnimePage(
  candidate: JKSearchResult,
  requestedTitle: string
): Promise<JKSearchResult | null> {
  const html = await fetchHtml(candidate.url);
  if (!html) { console.log("❌ No se pudo abrir:", candidate.url); return null; }
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || "";
  const dataTitle = html.match(/data-title=["']([^"']+)["']/i)?.[1] || "";
  const dataAnime = html.match(/data-anime=["']([^"']+)["']/i)?.[1] || "";
  const canonical = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)?.[1] || "";
  const pageTitle = dataTitle || ogTitle || candidate.title;
  const score = Math.max(
    titleScore(requestedTitle, pageTitle),
    titleScore(requestedTitle, candidate.title),
    dataAnime ? titleScore(requestedTitle, dataAnime.replace(/-/g, " ")) : 0
  );
  console.log("🧪 CANDIDATO:", candidate.title, "→", pageTitle, "score:", score);
  if (score < 0.60) return null;
  return { ...candidate, title: pageTitle, score };
}

// ======================================================
// RESOLVER SLUG REAL (BUSCAR + VALIDAR)
// ======================================================
export async function findJKAnimeSlug(
  input: string | { slug?: string; title?: string; anilistId?: number },
  env?: any,
  extraTitles: string[] = []
): Promise<string | null> {
  const title = typeof input === "string" ? input : input.title || input.slug || "";
  if (!title) return null;
  const queries = [title, ...extraTitles].filter(Boolean).map(normalize).filter(Boolean);
  const allCandidates = new Map<string, JKSearchResult>();

  for (const query of queries) {
    const results = await searchJKAnime(query);
    for (const result of results) {
      const score = Math.max(titleScore(title, result.title), titleScore(query, result.title));
      const existing = allCandidates.get(result.slug);
      if (!existing || score > (existing.score || 0)) {
        allCandidates.set(result.slug, { ...result, score });
      }
    }
  }

  const candidates = Array.from(allCandidates.values()).sort((a, b) => (b.score || 0) - (a.score || 0));
  console.log("🎯 JKAnime candidatos:", candidates.slice(0, 10).map(x => ({ title: x.title, slug: x.slug, score: x.score })));
  if (!candidates.length) { console.log("❌ JKAnime: ningún candidato"); return null; }

  for (const candidate of candidates.slice(0, 5)) {
    const verified = await inspectJKAnimePage(candidate, title);
    if (verified) {
      console.log("✅ JKAnime elegido:", verified.title, verified.slug, verified.score);
      return verified.slug;
    }
  }
  console.log("❌ JKAnime: ningún candidato pudo ser validado");
  return null;
}

// ======================================================
// EXTRAER VIDEO[] Y MAPEAR DESU/MAGI
// ======================================================
function extractVideoArray(html: string): Map<number, string> {
  const videos = new Map<number, string>();
  const regex = /video\s*\[\s*(\d+)\s*\]\s*=\s*(['"])([\s\S]*?)\2\s*;/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const index = Number(match[1]);
    const content = match[3];
    const srcMatch = content.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    let src = srcMatch[1];
    if (src.startsWith("//")) src = "https:" + src;
    if (src.startsWith("/")) src = JK_BASE + src;
    videos.set(index, src);
  }
  return videos;
}

function extractNamedPlayers(html: string, videos: Map<number, string>): JKServer[] {
  const servers: JKServer[] = [];
  const seen = new Set<string>();
  const regex = /<a\b[^>]*data-id=["'](\d+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const index = Number(match[1]);
    const name = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    if (name !== "desu" && name !== "magi") continue;
    const iframe = videos.get(index);
    if (!iframe) { console.log(`⚠️ ${name} encontrado pero video[${index}] no existe`); continue; }
    if (seen.has(iframe)) continue;
    seen.add(iframe);
    servers.push({ name: name === "desu" ? "Desu" : "Magi", url: iframe, type: "iframe" });
  }
  return servers;
}

// ======================================================
// OBTENER SERVIDORES DEL EPISODIO (SOLO DESU/MAGI)
// ======================================================
export async function getJKAnimeServers(slug: string, episode: number): Promise<JKServer[]> {
  const url = `${JK_BASE}/${slug}/${episode}/`;
  console.log("🎬 JKAnime episodio:", url);
  const html = await fetchHtml(url);
  if (!html) { console.log("❌ JKAnime episodio no devolvió HTML"); return []; }
  const videos = extractVideoArray(html);
  console.log("🎥 video[] encontrados:", Array.from(videos.keys()));
  const servers = extractNamedPlayers(html, videos);
  console.log("🎯 Desu/Magi encontrados:", servers);
  return servers;
}

// ======================================================
// CONTADOR DE EPISODIOS (último capítulo)
// ======================================================
export async function getJKAnimeLatestEpisode(slug: string): Promise<number | null> {
  const url = `${JK_BASE}/${slug}/`;
  const html = await fetchHtml(url);
  if (!html) return null;
  const pagMatch = html.match(/paginationEps\((\d+)\)/);
  if (pagMatch) return parseInt(pagMatch[1]);
  const idMatch = html.match(/anime_checks\('([^']+)',\s*'(\d+)'\)/);
  if (idMatch) {
    const animeId = idMatch[2];
    const ajaxRes = await fetchHtml(`${JK_BASE}/ajax/episodes/${animeId}/1`, {
      method: "POST",
      body: "_token=dummy"
    } as any);
    if (ajaxRes) {
      try {
        const data = JSON.parse(ajaxRes);
        return data.data?.length || null;
      } catch {}
    }
  }
  const links = html.match(/href="\/[^"]+\/(\d+)\/"/g);
  if (links) {
    const nums = links.map(h => parseInt(h.match(/(\d+)/)![0])).filter(n => !isNaN(n));
    if (nums.length) return Math.max(...nums);
  }
  return null;
}
