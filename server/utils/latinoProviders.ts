import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";
import { detectServerType } from "./serverTypes";

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
const LINK_REGEX = /href=["']([^"']+)["']/gi;
const STREAM_HINTS = [
  ".m3u8",
  ".mp4",
  "ok.ru",
  "okru",
  "streamtape",
  "filemoon",
  "voe",
  "dood",
  "streamwish",
  "vidhide",
  "uqload",
  "embed",
  "player"
];

function normalizeText (v: string): string {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function absolutize (url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  }
  catch {
    return url;
  }
}

function buildLatinoProxyUrl (url: string, env?: any): string | null {
  const raw = String(env?.LATINO_FETCH_PROXY || "").trim();
  if (!raw) return null;

  if (raw.includes("{url}")) {
    return raw.replace("{url}", encodeURIComponent(url));
  }

  return `${raw}${encodeURIComponent(url)}`;
}

async function latinoFetchHtml (url: string, env?: any): Promise<string | null> {
  const direct = await fetchHtml(url, {
    minLength: 60,
    retries: 2,
    timeoutMs: 5500
  });

  if (direct) return direct;

  const proxyUrl = buildLatinoProxyUrl(url, env);
  if (!proxyUrl) return null;

  return fetchHtml(proxyUrl, {
    minLength: 40,
    retries: 1,
    timeoutMs: 7000
  });
}

function looksLikeStreamUrl (url: string): boolean {
  const lower = String(url || "").toLowerCase();
  return STREAM_HINTS.some(h => lower.includes(h));
}

function isQuotaError (error: any): boolean {
  const msg = String(error?.message || error || "").toLowerCase();
  return msg.includes("daily limit exceeded")
    || msg.includes("quota")
    || msg.includes("browser")
    || msg.includes("failed to launch");
}

async function extractWithBrowser (targetUrl: string, env?: any): Promise<string[]> {
  if (!env?.BROWSER) return [];

  let browser: any;
  try {
    const puppeteerModule: any = await import("@cloudflare/puppeteer");
    const puppeteer = puppeteerModule.default || puppeteerModule;
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    const found = new Set<string>();

    await page.setRequestInterception(true);
    page.on("request", (req: any) => {
      const reqUrl = String(req.url() || "");
      const type = String(req.resourceType() || "");
      const blockedByType = ["image", "font", "stylesheet", "media"].includes(type);
      const blockedByDomain = /doubleclick|google-analytics|googletagmanager|facebook|hotjar|taboola|outbrain|ads/i.test(reqUrl);

      if (blockedByType || blockedByDomain) {
        req.abort();
        return;
      }

      if (looksLikeStreamUrl(reqUrl)) {
        found.add(reqUrl);
      }
      req.continue();
    });

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 9000
    });

    const domUrls = await page.evaluate(() => {
      const out = new Set<string>();
      const add = (v: string | null | undefined) => {
        if (!v) return;
        if (v.startsWith("http") || v.startsWith("//") || v.startsWith("/")) out.add(v);
      };

      document.querySelectorAll("iframe").forEach(el => add((el as HTMLIFrameElement).src));
      document.querySelectorAll("a,button,[data-src],[data-player],[onclick]").forEach((el) => {
        const node = el as HTMLElement;
        add(node.getAttribute("href") || "");
        add(node.getAttribute("data-src") || "");
        add(node.getAttribute("data-player") || "");
        const onClick = node.getAttribute("onclick") || "";
        const match = onClick.match(/https?:\/\/[^\s"'<>]+/gi) || [];
        match.forEach(v => add(v));
      });

      return Array.from(out);
    });

    for (const u of domUrls || []) {
      try {
        const abs = new URL(u, targetUrl).toString();
        if (looksLikeStreamUrl(abs)) found.add(abs);
      }
      catch {
        continue;
      }
    }

    const list = Array.from(found);
    if (list.length) {
      await browser.close();
      return list.slice(0, 25);
    }

    await browser.close();
    return [];
  }
  catch (error) {
    if (browser) {
      try {
        await browser.close();
      }
      catch {
        // noop
      }
    }
    if (isQuotaError(error)) return [];
    return [];
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

async function deepExtract (url: string, env?: any): Promise<string[]> {
  const html = await latinoFetchHtml(url, env);
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
      const nestedHtml = await latinoFetchHtml(u, env);
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

function providerSearchUrls (name: string, q: string): string[] {
  if (name === "latanime") {
    return [
      `https://latanime.org/?s=${encodeURIComponent(q)}`,
      `https://latanime.org/buscar/${encodeURIComponent(q)}`
    ];
  }

  if (name === "latinoanime") {
    return [
      `https://latinoanime.net/?s=${encodeURIComponent(q)}`,
      `https://latinoanime.net/buscar/${encodeURIComponent(q)}`
    ];
  }

  return [
    `https://www.animelatinohd.com/?s=${encodeURIComponent(q)}`,
    `https://www.animelatinohd.com/buscar/${encodeURIComponent(q)}`
  ];
}

async function discoverEpisodeUrlsFromSearch (
  name: string,
  slug: string,
  episode: number,
  variants: string[],
  env?: any
): Promise<string[]> {
  const queries = Array.from(new Set([slug, ...variants]))
    .map(v => normalizeText(v))
    .filter(Boolean)
    .slice(0, 8);

  const out = new Set<string>();

  for (const q of queries) {
    const searchPages = providerSearchUrls(name, q);
    const htmlPages = await Promise.allSettled(searchPages.map(u => latinoFetchHtml(u, env)));

    for (const page of htmlPages) {
      if (page.status !== "fulfilled" || !page.value) continue;

      for (const m of page.value.matchAll(LINK_REGEX)) {
        const href = absolutize(m[1], searchPages[0]);
        const nHref = normalizeText(href);

        if (!nHref.includes(String(episode))) continue;
        if (!queries.some(x => nHref.includes(x)) && !nHref.includes("episodio")) continue;
        out.add(href);
      }
    }
  }

  return Array.from(out).slice(0, 20);
}

async function scrapeProviderParallel (name: string, urls: string[], slug: string, episode: number, variants: string[], env?: any): Promise<ProviderResult> {
  const browserSeeds = await Promise.allSettled(urls.slice(0, 3).map(url => extractWithBrowser(url, env)));
  const browserExtracted = browserSeeds
    .filter(r => r.status === "fulfilled")
    .flatMap((r: any) => r.value || []);

  const jobs = await Promise.allSettled(urls.map(url => deepExtract(url, env)));

  const extracted = jobs
    .filter(r => r.status === "fulfilled")
    .flatMap((r: any) => r.value || []);

  let dedup = Array.from(new Set([...browserExtracted, ...extracted]));

  // Si la ruta directa falla, buscar enlaces por el search interno del proveedor.
  if (!dedup.length) {
    const discoveredUrls = await discoverEpisodeUrlsFromSearch(name, slug, episode, variants, env);
    if (discoveredUrls.length) {
      const searchJobs = await Promise.allSettled(discoveredUrls.map(url => deepExtract(url, env)));
      const searchExtracted = searchJobs
        .filter(r => r.status === "fulfilled")
        .flatMap((r: any) => r.value || []);

      dedup = Array.from(new Set(searchExtracted));
    }
  }

  const servers = dedup.map(embed => ({ name, embed }));

  return {
    name,
    triedUrls: urls.length + Math.min(urls.length, 3),
    extracted: extracted.length + browserExtracted.length,
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

function scoreServerUrl (url: string): number {
  const lower = String(url || "").toLowerCase();
  const type = detectServerType(lower);

  if (type === "hls" || lower.includes(".m3u8")) return 100;
  if (type === "mp4" || lower.includes(".mp4")) return 90;
  if (lower.includes("ok.ru") || lower.includes("okru")) return 80;
  if (lower.includes("streamtape")) return 70;
  if (lower.includes("dood")) return 40;
  if (lower.includes("embed") || lower.includes("player")) return 25;
  return 10;
}

async function prioritizeAndResolve (servers: RawServer[]): Promise<RawServer[]> {
  const resolved = await Promise.allSettled(
    servers.map(async (s) => {
      const finalUrl = await resolveServer(s.embed);
      return {
        ...s,
        embed: finalUrl || s.embed
      };
    })
  );

  const cleaned = resolved
    .filter(r => r.status === "fulfilled")
    .map((r: any) => r.value as RawServer)
    .filter(Boolean);

  return dedupeServers(cleaned)
    .sort((a, b) => scoreServerUrl(b.embed) - scoreServerUrl(a.embed));
}

export async function getLatinoProvidersServers (slug: string, episode: number, variants: string[], env?: any): Promise<RawServer[]> {
  const { latanime, latinoanime, animelatinohd } = buildProviderUrls(slug, episode, variants);

  const [a, b, c] = await Promise.all([
    scrapeProviderParallel("latanime", latanime, slug, episode, variants, env),
    scrapeProviderParallel("latinoanime", latinoanime, slug, episode, variants, env),
    scrapeProviderParallel("animelatinohd", animelatinohd, slug, episode, variants, env)
  ]);

  const merged = dedupeServers([
    ...a.servers,
    ...b.servers,
    ...c.servers
  ]);

  const prioritized = await prioritizeAndResolve(merged.slice(0, 50));
  return prioritized.slice(0, 30);
}

export async function getLatinoProvidersDebug (slug: string, episode: number, variants: string[], env?: any) {
  const { latanime, latinoanime, animelatinohd } = buildProviderUrls(slug, episode, variants);

  const [a, b, c] = await Promise.all([
    scrapeProviderParallel("latanime", latanime, slug, episode, variants, env),
    scrapeProviderParallel("latinoanime", latinoanime, slug, episode, variants, env),
    scrapeProviderParallel("animelatinohd", animelatinohd, slug, episode, variants, env)
  ]);

  const merged = dedupeServers([
    ...a.servers,
    ...b.servers,
    ...c.servers
  ]);
  const prioritized = await prioritizeAndResolve(merged.slice(0, 50));

  return {
    providers: [a, b, c],
    total: prioritized.length,
    sample: prioritized.slice(0, 15)
  };
}
