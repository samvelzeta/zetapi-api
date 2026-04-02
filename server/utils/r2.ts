// ==============================
// 🔥 R2 CONFIG
// ==============================

const R2_BASE = "https://pub-902a08f7869e43be91aefa973d603954.r2.dev";

// ==============================
// 🔥 NORMALIZAR SLUG
// ==============================

export function normalizeSlug(slug: string) {
  return slug
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
}

// ==============================
// 🔥 GENERAR POSIBLES SLUGS
// ==============================

export function generateSlugVariants(slug: string) {
  const base = normalizeSlug(slug);

  const variants = new Set<string>();

  variants.add(base);
  variants.add(base.replace(/-/g, ""));
  variants.add(base.replace(/-/g, "_"));

  variants.add(base.replace(/anime/g, "").trim());
  variants.add(base.replace(/season/g, "").trim());
  variants.add(base.replace(/\d+/g, "").trim());

  return Array.from(variants).filter(v => v.length > 2);
}

// ==============================
// 🔥 MATCH POR SIMILITUD REAL
// ==============================

// ==============================
// 🔥 MATCH ADN (SECUENCIAL)
// ==============================
export function findBestSlugMatch(input: string, candidates: string[]): string | null {

  const clean = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, "");

  const a = clean(input);

  let best: string | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {

    const b = clean(candidate);

    let score = 0;
    let j = 0;

    // 🔥 matching secuencial tipo ADN
    for (let i = 0; i < a.length; i++) {
      if (a[i] === b[j]) {
        score++;
        j++;
      }
      if (j >= b.length) break;
    }

    const similarity = score / a.length;

    if (similarity > bestScore) {
      bestScore = similarity;
      best = candidate;
    }
  }

  if (bestScore >= 0.4) {
    return best;
  }

  return null;
}

// ==============================
// 🔥 CONSTRUIR URL R2
// ==============================

export function buildR2Url(slug: string, episode: number) {
  return `${R2_BASE}/${slug}/${episode}/index.m3u8`;
}

// ==============================
// 🔥 OBTENER SLUGS DESDE R2
// ==============================

export async function getR2Slugs(): Promise<string[]> {
  try {
    const res = await fetch(`${R2_BASE}/_index.json`, {
      cache: "no-store"
    });

    if (!res.ok) return [];

    const data = await res.json();

    // esperado: { slugs: [] }
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.slugs)) return data.slugs;

    return [];
  } catch {
    return [];
  }
}

// ==============================
// 🔥 BUSCAR VIDEO EN R2 (SMART)
// ==============================

export async function getLatinoSource(
  slug: string,
  episode: number
) {

  // 1. intentar slug directo + variantes
  const variants = generateSlugVariants(slug);

  for (const s of variants) {
    const url = buildR2Url(s, episode);

    try {
      const res = await fetch(url, {
        method: "HEAD",
        cache: "no-store"
      });

      if (res.ok) return url;
    } catch {}
  }

  // 2. intentar con slugs reales del R2
  const r2Slugs = await getR2Slugs();

  if (r2Slugs.length) {
    const match = findBestSlugMatch(slug, r2Slugs);

    if (match) {
      const url = buildR2Url(match, episode);

      try {
        const res = await fetch(url, {
          method: "HEAD",
          cache: "no-store"
        });

        if (res.ok) return url;
      } catch {}
    }
  }

  return null;
}
