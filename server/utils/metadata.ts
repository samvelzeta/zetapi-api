export interface MetadataResult {
  titles: string[];
  malId: number | null;
  anilistId: number | null;
}

export async function getAnimeMetadata(title: string): Promise<MetadataResult> {
  try {
    const query = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
          idMal
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
    if (!media) return { titles: [], malId: null, anilistId: null };

    const titles = [
      media.title?.romaji,
      media.title?.english,
      media.title?.native,
      ...(media.synonyms || []),
    ].filter(Boolean) as string[];

    return {
      titles,
      malId: media.idMal ?? null,
      anilistId: media.id ?? null,
    };
  } catch {
    return { titles: [], malId: null, anilistId: null };
  }
}
