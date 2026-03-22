import { searchAnime } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  const apiKey = getHeader(event, "x-api-key");
  if (apiKey !== process.env.API_KEY) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "*");

  if (event.method === "OPTIONS") return;

  const { query, page } = getQuery(event) as { query: string, page: string };

  const fetchHTML = async (url: string) => {
    try {
      return await $fetch<string>(url, {
        headers: { "user-agent": "Mozilla/5.0" }
      });
    } catch {
      return null;
    }
  };

  const normalize = (items: any[]) =>
    items.map((i: any) => ({
      title: i.title,
      cover: i.cover || "",
      synopsis: i.synopsis || "",
      rating: i.rating || "",
      slug: i.slug || i.title?.toLowerCase().replace(/\s+/g, "-"),
      type: i.type || "",
      url: i.url || ""
    }));

  const sources = await Promise.allSettled([
    searchAnime(query, Number(page) || 1),

    (async () => {
      const html = await fetchHTML(`https://monoschinos2.com/buscar?q=${query}`);
      if (!html) return [];
      return [];
    })(),

    (async () => {
      const html = await fetchHTML(`https://gogoanime3.co/search.html?keyword=${query}`);
      if (!html) return [];
      return [];
    })(),

    (async () => {
      const html = await fetchHTML(`https://animeonline.ninja/?s=${query}`);
      if (!html) return [];
      return [];
    })(),

    (async () => {
      const html = await fetchHTML(`https://animeyt.tv/?s=${query}`);
      if (!html) return [];
      return [];
    })(),

    (async () => {
      const html = await fetchHTML(`https://animelhd.net/?s=${query}`);
      if (!html) return [];
      return [];
    })()
  ]);

  const results = sources
    .filter((r: any) => r.status === "fulfilled" && r.value)
    .flatMap((r: any) => (r.value.media ? r.value.media : r.value));

  const unique = Array.from(
    new Map(results.map((i: any) => [i.title, i])).values()
  );

  return {
    success: true,
    total: unique.length,
    data: normalize(unique)
  };
});
