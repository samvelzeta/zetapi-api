import { fetchHtml } from "./fetcher";

type LatestEpisode = {
  title: string;
  slug: string;
  episode: string;
  url: string;
  cover?: string;
  source: string;
};

function cleanText (v = "") {
  return v.replace(/\s+/g, " ").trim();
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

    if (!title) continue;

    items.push({
      title,
      slug: cleanText(title.toLowerCase().replace(/[^a-z0-9\s-]/gi, "").replace(/\s+/g, "-")),
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

export async function getLatestFallbackEpisodes (): Promise<LatestEpisode[]> {
  const [latanime, latinoanime, animelatinohd] = await Promise.all([
    scrapeSource("latanime", ["https://latanime.org", "https://latanime.org/episodios/"]),
    scrapeSource("latinoanime", ["https://latinoanime.net", "https://latinoanime.net/episodios/"]),
    scrapeSource("animelatinohd", ["https://www.animelatinohd.com", "https://www.animelatinohd.com/episodios/"])
  ]);

  const all = [...latanime, ...latinoanime, ...animelatinohd];
  const dedup = new Map<string, LatestEpisode>();

  for (const ep of all) {
    const key = ep.url.split("?")[0];
    if (!dedup.has(key)) dedup.set(key, ep);
  }

  return Array.from(dedup.values()).slice(0, 60);
}
