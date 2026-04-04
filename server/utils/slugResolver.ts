// ==============================
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[:\-]/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ==============================
// 🔥 SUPER RESOLVER (50+ variantes)
// ==============================
export function resolveSlugVariants(input: string): string[] {

  const base = normalize(input);
  const words = base.split(" ").filter(w => w.length > 1);

  const variants = new Set<string>();

  const joined = words.join("-");
  const compact = words.join("");
  const underscore = words.join("_");

  variants.add(joined);
  variants.add(compact);
  variants.add(underscore);

  // 🔥 versiones cortas
  if (words.length >= 2) {
    variants.add(words.slice(0, 2).join("-"));
    variants.add(words.slice(0, 3).join("-"));
  }

  // 🔥 sufijos clave
  const suffixes = [
    "",
    "-tv",
    "-tv-2",
    "-season-2",
    "-season-3",
    "-2nd-season",
    "-3rd-season",
    "-4th-season",
    "-part-2",
    "-sub",
    "-anime"
  ];

  for (const suf of suffixes) {
    variants.add(joined + suf);
    variants.add(compact + suf);
  }

  // 🔥 combinaciones progresivas
  for (let i = 0; i < words.length; i++) {
    const slice = words.slice(0, i + 1).join("-");
    variants.add(slice);
    variants.add(slice + "-tv");
  }

  // 🔥 casos especiales reales
  const map: Record<string, string[]> = {
    "black clover": ["black-clover-tv"],
    "shingeki no kyojin": ["attack-on-titan"],
    "boku no hero academia": ["my-hero-academia"],
    "kimetsu no yaiba": ["demon-slayer"],
    "jujutsu kaisen": ["jujutsu-kaisen-tv"]
  };

  for (const key in map) {
    if (base.includes(key)) {
      map[key].forEach(v => variants.add(v));
    }
  }

  return Array.from(variants)
    .map(v => v.replace(/--+/g, "-"))
    .filter(v => v.length > 2)
    .slice(0, 60);
}
