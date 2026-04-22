import {
  getJKAnimeServers,
  scrapePage
} from "./sources";

import { resolveSlugVariants } from "./slugResolver";
import { findJKAnimeSlug } from "./jkSearch";
import { detectServerType } from "./serverTypes";
import { getLatinoProvidersServers } from "./latinoProviders";
import { resolveServer } from "./resolver";

const PROXY = "https://zetapi-api.samvelzeta.workers.dev/proxy?url=";

function uniqueServers (list: any[]) {
  const seen = new Set();

  return list.filter((s) => {
    if (!s?.embed) return false;

    const clean = s.embed.split("?")[0];

    if (seen.has(clean)) return false;

    seen.add(clean);
    return true;
  });
}

function isBlockedServer (url: string): boolean {
  const u = url.toLowerCase();
  return u.includes("mega.nz") || u.includes("mega.io");
}

function isDirectPlayable (url: string): boolean {
  if (!url || isBlockedServer(url)) return false;

  const type = detectServerType(url);
  return type === "hls" || type === "mp4";
}

function isZilla (url: string) {
  return url.includes("zilla-networks");
}

function proxify (url: string): string {
  if (url.includes(PROXY)) return url;
  return `${PROXY}${encodeURIComponent(url)}`;
}

async function withTimeout<T> (promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: any;

  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });

  const result = await Promise.race([promise, timeoutPromise]);
  clearTimeout(timer);
  return result as T;
}

async function normalizeOutput (servers: any[]) {
  const resolved = await Promise.allSettled(
    servers
      .filter(s => s?.embed)
      .map(async (s) => {
        const original = String(s.embed || "");

        // Zilla: conservar instantáneamente (sin resolver)
        if (isZilla(original)) {
          return {
            name: "Z",
            type: "embed",
            lang: "mixed",
            embed: original
          };
        }

        const sourceLang = s.sourceLang === "lat" ? "lat" : "sub";

        // si ya es directo, no resolver para ahorrar tiempo
        if (isDirectPlayable(original)) {
          const type = detectServerType(original);
          return {
            name: `generic-${sourceLang}`,
            type,
            lang: sourceLang,
            embed: proxify(original)
          };
        }

        // solo aquí intentar resolver
        const finalUrl = await resolveServer(original);
        const candidate = finalUrl || original;

        if (isDirectPlayable(candidate)) {
          const type = detectServerType(candidate);

          return {
            name: `generic-${sourceLang}`,
            type,
            lang: sourceLang,
            embed: proxify(candidate)
          };
        }

        // mantener embed para no perder server
        if (original) {
          return {
            name: `generic-${sourceLang}`,
            type: "embed",
            lang: sourceLang,
            embed: original
          };
        }

        return null;
      })
  );

  const cleaned = resolved
    .filter(r => r.status === "fulfilled")
    .map((r: any) => r.value)
    .filter(Boolean);

  return uniqueServers(cleaned);
}

async function collectAV1 (variants: string[], number: number) {
  // priorizar pocos candidatos de alto valor para bajar latencia
  const topVariants = variants.slice(0, 10);
  const urls = topVariants.map(v => `https://animeav1.com/media/${v}/${number}`);

  const pages = await Promise.allSettled(urls.map(url => scrapePage(url)));

  const av1: any[] = [];

  for (const p of pages) {
    if (p.status !== "fulfilled" || !p.value?.length) continue;

    for (const s of p.value) {
      if (!isZilla(s.embed)) continue;

      av1.push({
        name: "Z",
        type: "embed",
        sourceLang: "mixed",
        embed: s.embed
      });
    }
  }

  // traer todos los zilla encontrados, normalmente 1-2
  return uniqueServers(av1).slice(0, 2);
}

async function collectJK (variants: string[], number: number, env: any) {
  const jk: any[] = [];
  const topVariants = variants.slice(0, 12);

  for (const v of topVariants) {
    let servers = await getJKAnimeServers(v, number);

    if (!servers.length) {
      const realSlug = await findJKAnimeSlug(v, env);
      if (realSlug) {
        servers = await getJKAnimeServers(realSlug, number);
      }
    }

    if (!servers.length) continue;

    for (const s of servers) {
      jk.push({
        name: "generic-sub",
        sourceLang: "sub",
        type: "hls",
        embed: s.embed
      });
    }

    if (jk.length >= 8) break;
  }

  return jk;
}

export async function getAllServers ({ slug, number, title, env, language }: any) {
  const variants = Array.from(new Set([
    slug,
    title || "",
    ...resolveSlugVariants(slug),
    ...resolveSlugVariants(title || "")
  ])).filter(Boolean).slice(0, 60);

  // AV1 rápido + timeout más amplio; fuentes secundarias con timeout más corto
  const [av1, jk, latinoRaw] = await Promise.all([
    withTimeout(collectAV1(variants, number), 9000, [] as any[]),
    withTimeout(collectJK(variants, number, env), 7000, [] as any[]),
    withTimeout(getLatinoProvidersServers(slug, number, variants), 7000, [] as any[])
  ]);

  const latino = latinoRaw.map((s: any) => ({ ...s, name: "generic-lat", sourceLang: "lat" }));

  // AV1 primero siempre
  const ordered = language === "latino" ? [...av1, ...latino, ...jk] : [...av1, ...jk, ...latino];

  const normalized = await withTimeout(normalizeOutput(ordered), 9000, av1);

  if (normalized.length) {
    return normalized.slice(0, 20);
  }

  return av1;
}
