export interface MetadataResult {
  titles: string[];
  malId: number | null;
  anilistId: number | null;
}

const EMPTY: MetadataResult = {
  titles: [],
  malId: null,
  anilistId: null,
};

export async function getAnimeMetadata(
  title: string,
  anilistId?: number,
): Promise<MetadataResult> {
  try {
    const queryById = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          idMal
          title {
            romaji
            english
            native
            userPreferred
          }
          synonyms
        }
      }
    `;

    const queryByTitle = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
          idMal
          title {
            romaji
            english
            native
            userPreferred
          }
          synonyms
        }
      }
    `;

    const query = anilistId
      ? queryById
      : queryByTitle;

    const variables = anilistId
      ? { id: anilistId }
      : { search: title };

    const response = await fetch(
      "https://graphql.anilist.co",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Accept:
            "application/json",
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      },
    );

    if (!response.ok) {
      return EMPTY;
    }

    const json: any =
      await response.json();

    const media =
      json?.data?.Media;

    if (!media) {
      return EMPTY;
    }

    const titles = [
      media.title?.userPreferred,
      media.title?.romaji,
      media.title?.english,
      media.title?.native,
      ...(Array.isArray(
        media.synonyms,
      )
        ? media.synonyms
        : []),
      title,
    ].filter(Boolean) as string[];

    return {
      titles: [
        ...new Set(titles),
      ],

      malId:
        media.idMal ?? null,

      anilistId:
        media.id ?? null,
    };
  } catch {
    return EMPTY;
  }
}
