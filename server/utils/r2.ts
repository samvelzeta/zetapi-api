// ==============================
// 🔥 R2 CONFIG
// ==============================

const R2_BASE = "https://pub-902a08f7869e43be91aefa973d603954.r2.dev";

// ⚠️ NO NECESITAS API KEYS AQUÍ
// ESTO ES SOLO LECTURA PÚBLICA

// ==============================
// 🔥 NORMALIZAR SLUG
// ==============================

export function normalizeSlug(slug: string) {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// ==============================
// 🔥 GENERAR POSIBLES SLUGS
// ==============================

export function generateSlugVariants(slug: string) {
  const base = normalizeSlug(slug);

  return [
    base,
    base.replace(/-/g, ""),
    base.replace(/-/g, "_"),
  ];
}

// ==============================
// 🔥 VERIFICAR SI EXISTE EN R2
// ==============================

export async function getLatinoSource(slug: string, episode: number) {
  const variants = generateSlugVariants(slug);

  for (const s of variants) {
    const url = `${R2_BASE}/${s}/${episode}/index.m3u8`;

    try {
      const res = await fetch(url, { method: "HEAD" });

      if (res.ok) {
        return url;
      }
    } catch {}
  }

  return null;
}
