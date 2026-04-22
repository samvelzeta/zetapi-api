import { fetchHtml } from "./fetcher";

type LatestEpisode = {
  title: string;
  slug: string;
  episode: string;
  url: string;
  cover?: string;
  source: string;
};

type SourceDetail = {
  source: string;
  extracted: number;
  keptAfterNormalize: number;
};

export type LatestFallbackBundle = {
  data: LatestEpisode[];
  sourceDetails: SourceDetail[];
};

function cleanText (v = "") {
  return v.replace(/\s+/g, " ").trim();
}

function normalizeSlugFromUrl (url: string, fallbackTitle: string): string {
  const byUrl = cleanText(
    url
      .toLowerCase()
      .replace(/https?:\/\/[^/]+\//, "")
      .replace(/episodio\/?\d+.*/, "")
      .replace(/episode\/?\d+.*/, "")
      .replace(/capitulo\/?\d+.*/, "")
      .replace(/[^a-z0-9/-]/g, "-")
      .split("/")
      .filter(Boolean)
      .pop() || ""
  ).replace(/-+/g, "-");

  if (byUrl.length > 2) return byUrl;

  return cleanText(
    fallbackTitle.toLowerCase().replace(/[^a-z0-9\s-]/gi, "").replace(/\s+/g, "-")
  );
}

function parseLatestFromHtml (html: string, base: string, source: string): LatestEpisode[] {
  const items: LatestEpisode[] = [];

  const cardRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = cardRegex.exec(html)) !== null) {
    const href = m[1] || "";
    const block = m[2] || "";

    if (!/episodio|episode|capitulo|ver/i.test(href)) continue;

    const url = new URL(href, base).toString();

    const title = cleanText(
      block.match(/title=["']([^"']+)["']/i)?.[1]
      || block.match(/alt=["']([^"']+)["']/i)?.[1]
      || block.replace(/<[^>]+>/g, " ")
    );

    const img = block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
    const episode = cleanText(url.match(/(?:episodio|episode|capitulo)[/-]?(\d+)/i)?.[1] || "");

    if (!title || !episode) continue;

    items.push({
      title,
      slug: normalizeSlugFromUrl(url, title),
      episode,
      url,
      cover: img ? new URL(img, base).toString() : undefined,
      source
    });
  }

  return items;
}

async function scrapeSource (source: string, urls: string[]): Promise<LatestEpisode[]> {
  const pages = await Promise.allSettled(urls.map(url => fetchHtml(url, { minLength: 120, retries: 1, timeoutMs: 8000 })));

  const merged = pages
    .filter(r => r.status === "fulfilled")
    .flatMap((r: any, idx) => {
      const html = r.value;
      if (!html) return [];
      return parseLatestFromHtml(html, urls[idx], source);
    });

  return merged;
}

function keepOnlyLatestPerAnime (episodes: LatestEpisode[]): LatestEpisode[] {
  const map = new Map<string, LatestEpisode>();

  for (const ep of episodes) {
    const key = ep.slug;
    const current = map.get(key);
    const n = Number(ep.episode || 0);
    const c = Number(current?.episode || 0);

    if (!current || n > c) {
      map.set(key, ep);
    }
  }

  return Array.from(map.values()).sort((a, b) => Number(b.episode) - Number(a.episode));
}

export async function getLatestFallbackBundle (): Promise<LatestFallbackBundle> {
  const [latanime, latinoanime, animelatinohd] = await Promise.all([
    scrapeSource("latanime", ["https://latanime.org", "https://latanime.org/episodios/"]),
    scrapeSource("latinoanime", ["https://latinoanime.net", "https://latinoanime.net/episodios/"]),
    scrapeSource("animelatinohd", ["https://www.animelatinohd.com", "https://www.animelatinohd.com/episodios/"])
  ]);

  const all = [...latanime, ...latinoanime, ...animelatinohd];

  const dedupByUrl = new Map<string, LatestEpisode>();
  for (const ep of all) {
    const key = ep.url.split("?")[0];
    if (!dedupByUrl.has(key)) dedupByUrl.set(key, ep);
  }

  const normalized = keepOnlyLatestPerAnime(Array.from(dedupByUrl.values())).slice(0, 60);

  const sourceDetails: SourceDetail[] = [
    { source: "latanime", extracted: latanime.length, keptAfterNormalize: normalized.filter(x => x.source === "latanime").length },
    { source: "latinoanime", extracted: latinoanime.length, keptAfterNormalize: normalized.filter(x => x.source === "latinoanime").length },
    { source: "animelatinohd", extracted: animelatinohd.length, keptAfterNormalize: normalized.filter(x => x.source === "animelatinohd").length }
  ];

  return {
    data: normalized,
    sourceDetails
  };
}
