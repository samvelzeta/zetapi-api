import { fetchHtml } from "../fetcher";

export interface AV1SearchResult {
  title: string;
  slug: string;
  malId: number | null;
  url: string;
}

export async function searchAnimeAV1(query: string): Promise<AV1SearchResult[]> {
  const clean = query.trim();
  if (!clean) return [];

  const url = `https://animeav1.com/catalogo?search=${encodeURIComponent(clean)}`;
  console.log("🔎 AV1 SEARCH:", url);
  const html = await fetchHtml(url);
  if (!html) return [];

  const results: AV1SearchResult[] = [];
  const seen = new Set<string>();

  // Extraer tarjetas de anime del catálogo
  const cardRegex = /<a[^>]*href="\/media\/([^/"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    const slug = match[1];
    const inner = match[2];
    const titleMatch = inner.match(/<h\d[^>]*>([^<]+)<\/h\d>/i);
    const title = titleMatch ? titleMatch[1].trim() : inner.replace(/<[^>]+>/g, " ").trim();
    if (!title || !slug) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    results.push({
      title,
      slug,
      malId: null, // lo obtendremos al inspeccionar la página
      url: `https://animeav1.com/media/${slug}`,
    });
  }

  return results;
}
