// ==============================
// 🔥 NORMALIZAR TÍTULO
// ==============================
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[:\-]/g, " ")
    .replace(/\b(season|temporada|part|parte|capitulo|episode)\b/g, "")
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ==============================
// 🔥 RECORTE INTELIGENTE (FIX REAL)
// ==============================
export function smartTrimSlug(slug: string) {

  let clean = slug
    .toLowerCase()
    .replace(/-\d+$/, "") // 🔥 FIX CLAVE (quita -1, -2...)
    .replace(/-/g, " ")
    .replace(/\b(season|temporada|part|parte)\b.*$/, "")
    .replace(/\b(tv|ova|ona)\b/g, "")
    .trim();

  return clean
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}

// ==============================
// 🔥 SLUGIFY
// ==============================
function toSlug(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
}

// ==============================
// 🔥 ANILIST
// ==============================
async function fetchAniList(title: string) {

  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query ($search: String) {
            Media(search: $search, type: ANIME) {
              title { romaji english native }
              synonyms
            }
          }
        `,
        variables: { search: title }
      })
    });

    const json = await res.json();
    return json?.data?.Media || null;

  } catch {
    return null;
  }
}

// ==============================
// 🔥 EXPANSIÓN
// ==============================
export function expandSlugVariants(input: string): string[] {

  const base = normalizeTitle(input);
  const variants = new Set<string>();

  variants.add(base);
  variants.add(base.replace(/ /g, "-"));
  variants.add(base.replace(/ /g, ""));
  variants.add(base.replace(/ /g, "_"));

  variants.add(base + " anime");
  variants.add(base + " online");
  variants.add(base + " sub");

  return Array.from(variants);
}

// ==============================
// 🔥 RESOLVER FINAL
// ==============================
export async function resolveSlugVariants(input: string): Promise<string[]> {

  const trimmed = smartTrimSlug(input);

  const variants = new Set<string>();

  variants.add(trimmed);

  expandSlugVariants(trimmed).forEach(v => variants.add(v));

  // 🔥 ANILIST
  const data = await fetchAniList(trimmed);

  if (data) {

    const titles = [
      data.title?.romaji,
      data.title?.english,
      data.title?.native,
      ...(data.synonyms || [])
    ];

    for (const t of titles) {

      if (!t) continue;

      const slug = toSlug(t);

      variants.add(slug);
      variants.add(slug.replace(/-/g, ""));
    }
  }

  return Array.from(variants)
    .filter(v => v.length > 2)
    .slice(0, 20);
}
