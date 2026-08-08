import { fetchHtml } from "../fetcher";

export interface JKSearchResult {
  title: string;
  slug: string;
  url: string;
}

export async function searchJKAnime(query: string): Promise<JKSearchResult[]> {
  const clean = query.trim();
  if (!clean) return [];

  const url = `https://jkanime.net/buscar/${encodeURIComponent(clean)}/1/`;
  console.log("🔎 JK SEARCH:", url);
  const html = await fetchHtml(url);
  if (!html) return [];

  const results: JKSearchResult[] = [];
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const slugMatch = href.match(/(?:https?:\/\/jkanime\.net)?\/([^/?#"']+)\/?/i);
    if (!slugMatch) continue;
    const slug = slugMatch[1];
    const title = match[2].replace(/<[^>]+>/g, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
    if (title.length < 2) continue;
    results.push({ title, slug, url: `https://jkanime.net/${slug}/` });
  }
  return results.filter((r, i, arr) => arr.findIndex(x => x.slug === r.slug) === i);
}
