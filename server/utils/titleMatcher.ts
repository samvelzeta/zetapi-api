export interface TitleCandidate {
  slug: string;
  title: string;
  [key: string]: any;
}

export function normalizeTitle(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(text: string): string {
  return normalizeTitle(text).replace(/\s+/g, "");
}

function tokenize(text: string): string[] {
  return normalizeTitle(text)
    .split(" ")
    .filter(token => token.length > 1);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) {
    previous[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }

    for (let j = 0; j <= b.length; j++) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function levenshteinSimilarity(
  a: string,
  b: string,
): number {
  const A = normalizeTitle(a);
  const B = normalizeTitle(b);

  if (!A || !B) return 0;

  return (
    1 -
    levenshtein(A, B) /
      Math.max(A.length, B.length)
  );
}

function tokenSimilarity(
  a: string,
  b: string,
): number {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));

  if (!A.size || !B.size) return 0;

  let common = 0;

  for (const token of A) {
    if (B.has(token)) common++;
  }

  return common / Math.max(A.size, B.size);
}

function orderedTokenSimilarity(
  a: string,
  b: string,
): number {
  const A = tokenize(a);
  const B = tokenize(b);

  if (!A.length || !B.length) return 0;

  let matched = 0;
  let cursor = 0;

  for (const token of A) {
    const index = B.indexOf(token, cursor);

    if (index >= 0) {
      matched++;
      cursor = index + 1;
    }
  }

  return matched / A.length;
}

function extractSeason(text: string): number | null {
  const normalized = normalizeTitle(text);

  const match = normalized.match(
    /\b(?:season|temporada|part|parte|cour|s)\s*(\d+)\b/,
  );

  return match ? Number(match[1]) : null;
}

function hasExplicitSeason(text: string): boolean {
  return /\b(?:season|temporada|part|parte|cour|s)\s*\d+\b/i.test(
    text,
  );
}

function hasYear(text: string): boolean {
  return /\b(?:19|20)\d{2}\b/.test(text);
}

export function buildSearchQueries(
  input: string,
  aliases: string[] = [],
): string[] {
  const raw = [input, ...aliases].filter(Boolean);

  const queries: string[] = [];

  const add = (value: string) => {
    const normalized = normalizeTitle(value);

    if (
      normalized &&
      !queries.includes(normalized)
    ) {
      queries.push(normalized);
    }
  };

  for (const value of raw) {
    add(value);

    const withoutSeason = normalizeTitle(value)
      .replace(
        /\b(?:season|temporada|part|parte|cour)\s*\d+\b/g,
        " ",
      )
      .replace(
        /\b\d+(?:st|nd|rd|th)\s+(?:season|temporada)\b/g,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();

    add(withoutSeason);

    const withoutYear = withoutSeason
      .replace(/\b(?:19|20)\d{2}\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    add(withoutYear);
  }

  const first = normalizeTitle(input)
    .split(" ")
    .filter(Boolean);

  for (
    let size = Math.min(4, first.length);
    size >= 2;
    size--
  ) {
    add(first.slice(0, size).join(" "));
  }

  return queries.slice(0, 12);
}

export function matchScore(
  candidateTitle: string,
  candidateSlug: string,
  queryTitles: string[],
): number {
  const candidate = normalizeTitle(candidateTitle);

  const slugTitle = normalizeTitle(
    candidateSlug.replace(/[-_]+/g, " "),
  );

  if (!candidate && !slugTitle) {
    return 0;
  }

  let best = 0;

  for (const queryTitle of queryTitles) {
    const query = normalizeTitle(queryTitle);

    if (!query) continue;

    const titleExact = candidate === query;
    const slugExact = slugTitle === query;

    if (titleExact) {
      best = Math.max(best, 100);
    }

    if (slugExact) {
      best = Math.max(best, 98);
    }

    const compactQuery = compact(query);

    if (compactQuery === compact(candidate)) {
      best = Math.max(best, 99);
    }

    if (candidate.includes(query)) {
      const extra = Math.max(
        0,
        candidate.length - query.length,
      );

      best = Math.max(
        best,
        extra <= 8 ? 94 : 89,
      );
    } else if (query.includes(candidate)) {
      best = Math.max(best, 86);
    }

    const lev = levenshteinSimilarity(
      query,
      candidate,
    );

    const tok = tokenSimilarity(
      query,
      candidate,
    );

    const ordered = orderedTokenSimilarity(
      query,
      candidate,
    );

    const slugTok = tokenSimilarity(
      query,
      slugTitle,
    );

    best = Math.max(
      best,
      lev * 38 +
        tok * 34 +
        ordered * 18 +
        slugTok * 10,
    );

    const querySeason = extractSeason(query);
    const candidateSeason = extractSeason(candidate);

    if (
      querySeason !== null &&
      candidateSeason !== null &&
      querySeason !== candidateSeason
    ) {
      best -= 25;
    } else if (
      querySeason !== null &&
      candidateSeason === null
    ) {
      best -= 15;
    } else if (
      querySeason === null &&
      candidateSeason !== null
    ) {
      best -= 6;
    }

    if (
      !hasYear(query) &&
      hasYear(candidate)
    ) {
      best -= 3;
    }
  }

  return Math.max(
    0,
    Math.min(100, best),
  );
}

export function rankCandidates<
  T extends TitleCandidate
>(
  candidates: T[],
  queryTitles: string[],
): Array<T & { score: number }> {
  const ranked = candidates.map(candidate => ({
    ...candidate,
    score: matchScore(
      candidate.title,
      candidate.slug,
      queryTitles,
    ),
  }));

  ranked.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.title.length - b.title.length;
  });

  return ranked;
}
