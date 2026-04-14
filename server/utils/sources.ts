import { fetchHtml } from "./fetcher";

// ======================
// 🔥 BUSCAR SLUG EN AV1
// ======================
export async function findAV1Slug(query: string): Promise<string | null> {

  try {

    const url = `https://animeav1.com/search?q=${encodeURIComponent(query)}`;

    const html = await fetchHtml(url);

    if (!html) return null;

    // 🔥 extraer links de media
    const matches = [
      ...html.matchAll(/\/media\/([a-z0-9\-]+)/g)
    ];

    if (!matches.length) return null;

    // 🔥 primer resultado (mejorar luego con fuzzy si quieres)
    return matches[0][1];

  } catch {
    return null;
  }
}
