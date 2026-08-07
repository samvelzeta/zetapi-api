function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveSlugVariants(input: string, extraTitles: string[] = []): string[] {
  const baseTitles = [input, ...extraTitles].filter(Boolean).map(normalize);
  const variants = new Set<string>();

  for (const base of baseTitles) {
    const words = base.split(" ").filter(w => w.length > 1);
    if (words.length === 0) continue;

    const joined = words.join("-");
    variants.add(joined);

    // Quitar "season X" y poner solo número
    const noSeason = base.replace(/\bseason\s*(\d+)\b/i, "$1").replace(/\s+/g, "-");
    variants.add(noSeason);

    // Reemplazar "season X" por "tv-X"
    const withTV = base.replace(/\bseason\s*(\d+)\b/i, "tv-$1").replace(/\s+/g, "-");
    variants.add(withTV);

    // Versiones cortas (2-4 palabras)
    for (let i = 2; i <= 4; i++) {
      if (words.length >= i) variants.add(words.slice(0, i).join("-"));
    }

    // Sufijos comunes
    const suffixes = ["", "-tv", "-tv-2", "-2nd-season", "-season-2", "-part-2", "-2"];
    for (const suf of suffixes) {
      variants.add(joined + suf);
    }

    // Versión sin espacios
    variants.add(words.join(""));
  }

  return [...variants].filter(v => v.length > 2).slice(0, 100);
}
