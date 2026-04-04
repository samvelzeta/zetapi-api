import { fetchHtml } from "./fetcher";

// ==============================
// 🔥 LIMPIAR TEXTO
// ==============================
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

// ==============================
// 🔥 SIMILITUD SIMPLE
// ==============================
function similarity(a: string, b: string): number {

  const aw = normalize(a).split(" ");
  const bw = normalize(b).split(" ");

  let score = 0;

  for (const w of aw) {
    if (bw.includes(w)) score++;
  }

  return score;
}

// ==============================
// 🔥 EXTRAER SLUGS
// ==============================
function extractSlugs(html: string): { slug: string, title: string }[] {

  const results: { slug: string, title: string }[] = [];

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
// 🔥 BUSCAR SLUG REAL
// ==============================
export async function findJKAnimeSlug(query: string): Promise<string | null> {

  try {

    const url = `https://jkanime.net/buscar/${encodeURIComponent(query)}`;
    const html = await fetchHtml(url);

    if (!html) return null;

    const results = extractSlugs(html);

    if (!results.length) return null;

    let best = results[0];
    let bestScore = 0;

    for (const r of results) {

      const score = similarity(query, r.title);

      if (score > bestScore) {
        best = r;
        bestScore = score;
      }
    }

    return best.slug;

  } catch {
    return null;
  }
}
