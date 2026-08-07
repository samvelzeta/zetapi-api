export interface MetadataResult {
  titles: string[]; // todas las variantes normalizadas
}

async function fetchAniListTitles(title: string): Promise<string[]> {
  try {
    const query = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          title { romaji english native }
          synonyms
        }
      }
    `;
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { search: title } }),
    });
    const json = await res.json();
    const media = json?.data?.Media;
    if (!media) return [];
    return [
      media.title?.romaji,
      media.title?.english,
      media.title?.native,
      ...(media.synonyms || []),
    ].filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchJikanTitles(title: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`
    );
    const json = await res.json();
    const anime = json?.data?.[0];
    if (!anime) return [];
    return [
      anime.title,
      anime.title_english,
      anime.title_japanese,
      ...(anime.title_synonyms || []),
    ].filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchKitsuTitles(title: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(title)}&page[limit]=1`
    );
    const json = await res.json();
    const anime = json?.data?.[0];
    if (!anime) return [];
    const attrs = anime.attributes;
    return [
      attrs.canonicalTitle,
      attrs.titles?.en,
      attrs.titles?.en_jp,
      attrs.titles?.ja_jp,
      ...(attrs.abbreviatedTitles || []),
    ].filter(Boolean);
  } catch {
    return [];
  }
}

export async function getAnimeMetadata(title: string): Promise<MetadataResult> {
  const [aniList, jikan, kitsu] = await Promise.all([
    fetchAniListTitles(title),
    fetchJikanTitles(title),
    fetchKitsuTitles(title),
  ]);

  const allTitles = [...new Set([title, ...aniList, ...jikan, ...kitsu])];
  return { titles: allTitles };
}
