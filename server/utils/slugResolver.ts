// ==============================
// 🔥 NORMALIZAR TÍTULO
// ==============================
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[:\-]/g, " ")
    .replace(/\b(season|temporada|part|parte|capitulo|episode)\b/g, "")
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}


//otro resolvedor
export function smartTrimSlug(slug: string) {

  let clean = slug
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\b(season|temporada|part|parte)\b.*$/, "") // 🔥 corta todo después
    .replace(/\b(tv|ova|ona)\b/g, "")
    .trim();

  // volver a slug
  return clean
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}


// ==============================
// 🔥 EXPANSIÓN AVANZADA
// ==============================
export function expandSlugVariants(input: string): string[] {

  const base = normalizeTitle(input);
  const variants = new Set<string>();

  // base
  variants.add(base);

  // formatos
  variants.add(base.replace(/ /g, "-"));
  variants.add(base.replace(/ /g, ""));
  variants.add(base.replace(/ /g, "_"));

  // idioma
  variants.add(base + " anime");
  variants.add(base + " online");
  variants.add(base + " latino");
  variants.add(base + " sub");
  variants.add(base + " castellano");

  // simplificaciones
  variants.add(base.replace("the", ""));
  variants.add(base.replace("no", ""));
  variants.add(base.replace("of", ""));

  // romaji típicos
  variants.add(base.replace("shingeki no kyojin", "attack on titan"));
  variants.add(base.replace("boku no hero", "my hero academia"));

  // casos especiales manuales (🔥 importante)
  if (base.includes("one piece")) {
    variants.add("one-piece");
    variants.add("onepiece");
  }

  if (base.includes("dragon ball")) {
    variants.add("dragon-ball");
  }

  return Array.from(variants).filter(v => v.length > 2);
}
