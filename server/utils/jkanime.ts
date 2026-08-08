import { fetchHtml } from "./fetcher";

const JK_BASE = "https://jkanime.net";

// ======================================================
// TIPOS
// ======================================================
export interface JKAnimeSearchResult {
  title: string;
  slug: string;
  url: string;
  score: number;
}

export interface JKAnimeServer {
  name: string;
  type: "iframe";
  embed: string;
  lang: "sub";
}

export interface JKSubtitle {
  lang: string;
  url: string;
}

// ======================================================
// NORMALIZACIÓN
// ======================================================
function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
}

function stripHtml(text: string): string {
  return decodeHtml(text)
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
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ======================================================
// SLUG
// ======================================================
function extractSlug(href: string): string | null {
  try {
    const url = new URL(href, JK_BASE);
    if (url.hostname !== "jkanime.net") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 1) return null;
    const slug = parts[0].trim();
    if (!slug) return null;
    const reserved = new Set([
      "buscar", "genero", "temporada", "studio", "usuario",
      "dash", "directorio", "ranking", "top", "horario",
      "historial", "login", "logout", "ajax"
    ]);
    return reserved.has(slug.toLowerCase()) ? null : slug;
  } catch { return null; }
}

// ======================================================
// EXTRAER RESULTADOS DE BÚSQUEDA
// ======================================================
function extractSearchResults(html: string): JKAnimeSearchResult[] {
  const results: JKAnimeSearchResult[] = [];
  const seen = new Set<string>();
  const regex = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const attrs = match[1];
    const content = match[2];
    const hrefMatch = attrs.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1] ?? hrefMatch[2];
    const slug = extractSlug(href);
    if (!slug) continue;

    let title: string | null = null;
    const titleMatch = attrs.match(/\btitle\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
    if (titleMatch) {
      title = decodeHtml(titleMatch[1] ?? titleMatch[2] ?? "");
    }
    if (!title) {
      const heading = content.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
      if (heading) title = stripHtml(heading[1]);
    }
    if (!title) title = stripHtml(content);
    title = title?.trim() ?? "";
    if (!title || title.length < 2) continue;

    const key = slug.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ title, slug, url: `${JK_BASE}/${slug}/`, score: 0 });
  }
  return results;
}

// ======================================================
// BÚSQUEDA EN JKANIME
// ======================================================
export async function searchJKAnime(query: string): Promise<JKAnimeSearchResult[]> {
  const clean = query.trim();
  if (!clean) return [];
  const url = `${JK_BASE}/buscar/${encodeURIComponent(clean)}/`;
  console.log(`[JK SEARCH] ${url}`);
  const html = await fetchHtml(url);
  if (!html) {
    console.log("[JK SEARCH] HTML vacío");
    return [];
  }
  const results = extractSearchResults(html);
  console.log(`[JK SEARCH] ${results.length} resultados`);
  return results;
}

// ======================================================
// FUZZY
// ======================================================
function levenshtein(a: string, b: string): number {
  const aa = normalize(a);
  const bb = normalize(b);
  const matrix: number[][] = [];
  for (let i = 0; i <= aa.length; i++) { matrix[i] = []; matrix[i][0] = i; }
  for (let j = 0; j <= bb.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= aa.length; i++) {
    for (let j = 1; j <= bb.length; j++) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[aa.length][bb.length];
}

function similarity(a: string, b: string): number {
  const aa = normalize(a);
  const bb = normalize(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 1;
  if (aa.includes(bb) || bb.includes(aa)) return 0.94;
  const distance = levenshtein(aa, bb);
  return 1 - distance / Math.max(aa.length, bb.length);
}

function tokenScore(a: string, b: string): number {
  const A = new Set(normalize(a).split(" ").filter(Boolean));
  const B = new Set(normalize(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const word of A) if (B.has(word)) common++;
  return common / Math.max(A.size, B.size);
}

// ======================================================
// RESOLVER SLUG REAL
// ======================================================
export async function findJKAnimeSlug(
  title: string,
  alternatives: string[] = []
): Promise<string | null> {
  const queries = [title, ...alternatives]
    .filter(Boolean)
    .map(x => x.trim())
    .filter((x, i, arr) => arr.findIndex(y => normalize(y) === normalize(x)) === i);

  const all = new Map<string, JKAnimeSearchResult>();
  for (const query of queries) {
    const results = await searchJKAnime(query);
    for (const result of results) {
      const sim = similarity(title, result.title);
      const tokens = tokenScore(title, result.title);
      let score = sim * 70 + tokens * 30;
      if (normalize(title) === normalize(result.title)) score = 100;
      const old = all.get(result.slug);
      if (!old || score > old.score) all.set(result.slug, { ...result, score });
    }
  }

  const ranked = [...all.values()].sort((a, b) => b.score - a.score);
  console.log("[JK RESOLVER]", JSON.stringify(ranked.slice(0, 10), null, 2));
  if (!ranked.length) return null;
  if (ranked[0].score < 72) return null;
  return ranked[0].slug;
}

// ======================================================
// EXTRAER VIDEO[] (DESU/MAGI)
// ======================================================
function extractJKVideoArray(html: string): string[] {
  const videos: string[] = [];
  const regex = /video\s*\[\s*(\d+)\s*\]\s*=\s*(['"])([\s\S]*?)\2\s*;/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const iframeHtml = match[3];
    const srcMatch = iframeHtml.match(/<iframe\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1/i);
    if (!srcMatch) continue;
    let url = srcMatch[2];
    if (url.startsWith("//")) url = "https:" + url;
    if (url.startsWith("/")) url = JK_BASE + url;
    if (!/^https?:\/\//i.test(url)) continue;
    if (!videos.includes(url)) videos.push(url);
  }
  return videos;
}

// ======================================================
// EXTRAER SERVIDORES DEL EPISODIO (SOLO DESU/MAGI)
// ======================================================
export async function getJKAnimeServers(
  slug: string,
  episode: number
): Promise<JKAnimeServer[]> {
  const url = `${JK_BASE}/${slug}/${episode}/`;
  console.log(`[JK EPISODE] ${url}`);
  const html = await fetchHtml(url);
  if (!html) { console.log("[JK EPISODE] HTML vacío"); return []; }

  const videos = extractJKVideoArray(html);
  console.log(`[JK EPISODE] video[] = ${videos.length}`);

  // Mapear data-id -> nombre (Desu/Magi)
  const buttonMap = new Map<number, string>();
  const buttonRegex = /<a\b[^>]*data-id=["'](\d+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let btnMatch;
  while ((btnMatch = buttonRegex.exec(html))) {
    const index = Number(btnMatch[1]);
    const name = btnMatch[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    if (name === "desu" || name === "magi") buttonMap.set(index, name);
  }

  const servers: JKAnimeServer[] = [];
  for (let i = 0; i < videos.length; i++) {
    const name = buttonMap.get(i);
    if (name) {
      servers.push({
        name: name === "desu" ? "Desu" : "Magi",
        type: "iframe",
        embed: videos[i],
        lang: "sub"
      });
    }
  }

  return servers;
}

// ======================================================
// SUBTÍTULOS EN ESPAÑOL
// ======================================================
export async function getJKAnimeSubtitles(
  slug: string,
  episode: number
): Promise<JKSubtitle[]> {
  const url = `https://jkanime.net/${slug}/${episode}/`;
  const html = await fetchHtml(url);
  if (!html) return [];

  const subs: JKSubtitle[] = [];
  const seen = new Set<string>();
  const subMatches = html.matchAll(
    /<button[^>]+data-url="([^"]+)"[^>]+data-language="([^"]*)"[^>]*>/g
  );
  for (const m of subMatches) {
    const subUrl = m[1];
    const lang = m[2].toLowerCase();
    if ((lang === "es" || lang.includes("spa") || lang.includes("español")) && !seen.has(subUrl)) {
      seen.add(subUrl);
      subs.push({ lang: "Español", url: subUrl });
    }
  }
  return subs;
}

// ======================================================
// CONTADOR DE EPISODIOS (para latestEpisode)
// ======================================================
export async function getJKAnimeLatestEpisode(slug: string): Promise<number | null> {
  const url = `${JK_BASE}/${slug}/`;
  const html = await fetchHtml(url);
  if (!html) return null;

  // Método 1: paginationEps(numero)
  const pagMatch = html.match(/paginationEps\((\d+)\)/);
  if (pagMatch) return parseInt(pagMatch[1]);

  // Método 2: AJAX a /ajax/episodes/ID/1
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

  // Método 3: contar enlaces de episodios
  const links = html.match(/href="\/[^"]+\/(\d+)\/"/g);
  if (links) {
    const nums = links.map(h => parseInt(h.match(/(\d+)/)![0])).filter(n => !isNaN(n));
    if (nums.length) return Math.max(...nums);
  }
  return null;
}
