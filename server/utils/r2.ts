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
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") // 🔥 limpia bordes
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

  // 🔥 variantes adicionales inteligentes
  variants.add(base.replace(/anime/g, "").trim());
  variants.add(base.replace(/season/g, "").trim());
  variants.add(base.replace(/\d+/g, "").trim());

  return Array.from(variants).filter(v => v.length > 2);
}

// ==============================
// 🔥 CONSTRUIR URL R2
// ==============================

export function buildR2Url(slug: string, episode: number) {
  return `${R2_BASE}/${slug}/${episode}/index.m3u8`;
}

// ==============================
// 🔥 VERIFICAR SI EXISTE EN R2
// ==============================

export async function getLatinoSource(
  slug: string,
  episode: number
) {

  const variants = generateSlugVariants(slug);

  for (const s of variants) {

    const url = buildR2Url(s, episode);

    try {
      const res = await fetch(url, {
        method: "HEAD",
        cache: "no-store" // 🔥 evita cache incorrecto
      });

      if (res.ok) {
        return url;
      }

    } catch {}
  }

  return null;
}
