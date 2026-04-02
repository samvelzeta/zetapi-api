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
// 🔥 GENERAR VARIANTES
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
// 🔥 CONSTRUIR URL
// ==============================

export function buildR2Url(slug: string, episode: number) {
  return `${R2_BASE}/${slug}/${episode}/index.m3u8`;
}

// ==============================
// 🔥 BUSCAR EN R2 (OPTIMIZADO)
// ==============================

export async function getLatinoSource(
  slug: string,
  episode: number
) {
  const variants = generateSlugVariants(slug);

  // 🔥 LIMITAMOS PARA EVITAR LENTITUD
  const limited = variants.slice(0, 3);

  const checks = await Promise.allSettled(
    limited.map(s => {
      const url = buildR2Url(s, episode);

      return fetch(url, {
        method: "GET",
        cache: "no-store"
      }).then(res => ({
        ok: res.ok,
        url
      }));
    })
  );

  for (const r of checks) {
    if (r.status === "fulfilled" && r.value.ok) {
      return r.value.url;
    }
  }

  return null;
}
