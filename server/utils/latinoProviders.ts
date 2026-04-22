import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

export type RawServer = {
  name: string;
  embed: string;
};

type ProviderResult = {
  name: string;
  triedUrls: number;
  extracted: number;
  resolvedDirect: number;
  servers: RawServer[];
};

const VIDEO_REGEX = /https?:\/\/[^\s"'<>]+(?:\.m3u8|\.mp4)(?:\?[^\s"'<>]*)?/gi;

function absolutize (url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  }
  catch {
    return url;
  }
}

function extractCandidates (html: string, base: string): string[] {
  const out = new Set<string>();

  for (const m of html.matchAll(VIDEO_REGEX)) {
    out.add(m[0]);
  }

  for (const m of html.matchAll(/(?:src|data-src|href)=["']([^"']+)["']/gi)) {
    const u = m[1];
    if (!u) continue;

    if (u.includes(".m3u8") || u.includes(".mp4")) {
      out.add(absolutize(u, base));
    }

    if (u.includes("embed") || u.includes("player") || u.includes("stream")) {
      out.add(absolutize(u, base));
    }
  }

  return Array.from(out);
}

async function deepExtract (url: string): Promise<string[]> {
  const html = await fetchHtml(url, { minLength: 80 });
  if (!html) return [];

  const first = extractCandidates(html, url);
  const direct = first.filter(u => u.includes(".m3u8") || u.includes(".mp4"));
  const embeds = first.filter(u => !direct.includes(u)).slice(0, 12);

  const resolvedEmbeds = await Promise.allSettled(
    embeds.map(u => resolveServer(u))
  );

  const resolved = resolvedEmbeds
    .filter(r => r.status === "fulfilled")
    .map((r: any) => r.value)
    .filter(Boolean) as string[];

  const resolvedDirect = resolved.filter(u => u.includes(".m3u8") || u.includes(".mp4"));

  const nested = await Promise.allSettled(
    embeds.map(async (u) => {
      const nestedHtml = await fetchHtml(u, { minLength: 80 });
      if (!nestedHtml) return [] as string[];
      return extractCandidates(nestedHtml, u).filter(v => v.includes(".m3u8") || v.includes(".mp4"));
    })
  );

  const nestedFound = nested
    .filter(r => r.status === "fulfilled")
    .flatMap((r: any) => r.value || []);

  return Array.from(new Set([
    ...direct,
    ...resolvedDirect,
    ...nestedFound
  ]));
}

function buildProviderUrls (slug: string, episode: number, variants: string[]) {
  const uniqueVariants = Array.from(new Set([slug, ...variants])).filter(Boolean).slice(0, 30);

  return {
    latanime: uniqueVariants.flatMap(v => [
      `https://latanime.org/ver/${v}-${episode}`,
      `https://latanime.org/episodio/${v}-${episode}`
    ]),
    latinoanime: uniqueVariants.flatMap(v => [
      `https://latinoanime.net/ver/${v}-${episode}`,
      `https://latinoanime.net/episodio/${v}-${episode}`
    ]),
    animelatinohd: uniqueVariants.flatMap(v => [
      `https://www.animelatinohd.com/ver/${v}-episodio-${episode}`,
      `https://www.animelatinohd.com/episodio/${v}-${episode}`
    ])
  };
}

async function scrapeProviderParallel (name: string, urls: string[]): Promise<ProviderResult> {
  const jobs = await Promise.allSettled(urls.map(url => deepExtract(url)));

  const extracted = jobs
    .filter(r => r.status === "fulfilled")
    .flatMap((r: any) => r.value || []);

  const dedup = Array.from(new Set(extracted));

  const servers = dedup.map(embed => ({ name, embed }));

  return {
    name,
    triedUrls: urls.length,
    extracted: extracted.length,
    resolvedDirect: dedup.length,
    servers
  };
}

function dedupeServers (servers: RawServer[]) {
  const map = new Map<string, RawServer>();

  for (const s of servers) {
    const key = s.embed.split("?")[0];
    if (!map.has(key)) map.set(key, s);
  }

  return Array.from(map.values());
}

export async function getLatinoProvidersServers (slug: string, episode: number, variants: string[]): Promise<RawServer[]> {
  const { latanime, latinoanime, animelatinohd } = buildProviderUrls(slug, episode, variants);

  const [a, b, c] = await Promise.all([
    scrapeProviderParallel("latanime", latanime),
    scrapeProviderParallel("latinoanime", latinoanime),
    scrapeProviderParallel("animelatinohd", animelatinohd)
  ]);

  return dedupeServers([
    ...a.servers,
    ...b.servers,
    ...c.servers
  ]).slice(0, 30);
}

export async function getLatinoProvidersDebug (slug: string, episode: number, variants: string[]) {
  const { latanime, latinoanime, animelatinohd } = buildProviderUrls(slug, episode, variants);

  const [a, b, c] = await Promise.all([
    scrapeProviderParallel("latanime", latanime),
    scrapeProviderParallel("latinoanime", latinoanime),
    scrapeProviderParallel("animelatinohd", animelatinohd)
  ]);

  const merged = dedupeServers([
    ...a.servers,
    ...b.servers,
    ...c.servers
  ]);

  return {
    providers: [a, b, c],
    total: merged.length,
    sample: merged.slice(0, 15)
  };
}
