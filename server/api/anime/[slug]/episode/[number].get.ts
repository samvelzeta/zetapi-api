import { getEpisode, searchAnime, getAnimeInfo } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event) as { id: string };

  const anilist = await $fetch<any>("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: {
      query: `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            title { romaji english native }
            synonyms
          }
        }
      `,
      variables: { id: Number(id) }
    }
  }).catch(() => null);

  if (!anilist?.data?.Media) {
    throw createError({ statusCode: 404 });
  }

  const media = anilist.data.Media;

  const normalize = (t: string) =>
    t.toLowerCase()
      .replace(/[:]/g, "")
      .replace(/\(.*?\)/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^\w-]/g, "");

  const names = [
    media.title?.romaji,
    media.title?.english,
    media.title?.native,
    ...(media.synonyms || [])
  ].filter(Boolean);

  let best: any = null;

  for (const name of names) {
    try {
      const search = await searchAnime(normalize(name), 1);
      if (search?.media?.length) {
        best = search.media[0];
        break;
      }
    } catch {}
  }

  if (!best) throw createError({ statusCode: 404 });

  const info = await getAnimeInfo(best.slug).catch(() => null);

  return {
    success: true,
    data: {
      resolvedSlug: best.slug,
      title: info?.title,
      cover: info?.cover,
      episodes: info?.episodes || []
    }
  };
});
