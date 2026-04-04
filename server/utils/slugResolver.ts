 const words = base.split(" ").filter(w => w.length > 1);

  const variants = new Set<string>();

  // ======================
  // 🔥 BASES
  // ======================
  const joined = words.join("-");
  const compact = words.join("");
  const underscore = words.join("_");

  variants.add(joined);
  variants.add(compact);
  variants.add(underscore);

  // ======================
  // 🔥 VERSIONES CORTAS
  // ======================
  if (words.length >= 2) {
    variants.add(words.slice(0, 2).join("-"));
    variants.add(words.slice(0, 3).join("-"));
  }

  // ======================
  // 🔥 SUFIJOS CLAVE (JKANIME)
  // ======================
  const suffixes = [
    "",
    "-tv",
    "-tv-2",
    "-tv-3",
    "-season-2",
    "-season-3",
    "-2nd-season",
    "-3rd-season",
    "-4th-season",
    "-part-2",
    "-part-3",
    "-sub",
    "-anime"
  ];

  for (const suf of suffixes) {
    variants.add(joined + suf);
    variants.add(compact + suf);
  }

  // ======================
  // 🔥 VARIANTES COMBINADAS
  // ======================
  for (let i = 0; i < words.length; i++) {
    const slice = words.slice(0, i + 1).join("-");
    variants.add(slice);
    variants.add(slice + "-tv");
    variants.add(slice + "-season");
  }

  // ======================
  // 🔥 CASOS ESPECIALES
  // ======================
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

  // ======================
  // 🔥 LIMPIEZA FINAL
  // ======================
  return Array.from(variants)
    .map(v => v.replace(/--+/g, "-"))
    .filter(v => v.length > 2)
    .slice(0, 60); // 🔥 límite fuerte
}
