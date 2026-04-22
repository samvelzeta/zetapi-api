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

function proxify (url: string): string {
  if (url.includes(PROXY)) return url;
  return `${PROXY}${encodeURIComponent(url)}`;
}

async function normalizeDirectOutput (servers: any[], label = "Dub") {
  const resolved = await Promise.allSettled(
    servers
      .filter(s => s?.embed)
      .map(async (s) => {
        const finalUrl = await resolveServer(s.embed);
        if (!finalUrl || !isDirectPlayable(finalUrl)) return null;

        const type = detectServerType(finalUrl);

        return {
          name: label,
          type,
          embed: proxify(finalUrl)
        };
      })
  );

  const cleaned = resolved
    .filter(r => r.status === "fulfilled")
    .map((r: any) => r.value)
    .filter(Boolean);

  return uniqueServers(cleaned);
}

function isZilla (url: string) {
  return url.includes("zilla-networks");
}

async function collectAV1 (variants: string[], number: number) {
  const av1: any[] = [];

  for (const v of variants) {
    const url = `https://animeav1.com/media/${v}/${number}`;
    const scraped = await scrapePage(url);

    if (!scraped.length) continue;

    for (const s of scraped) {
      if (!isZilla(s.embed)) continue;

      av1.push({
        name: "AV1",
        type: "hls",
        embed: s.embed
      });
    }

    // AV1 principal: máximo 2 servers como pediste
    if (av1.length >= 2) break;
  }

  return av1;
}

async function collectJK (variants: string[], number: number, env: any) {
  const jk: any[] = [];

  for (const v of variants) {
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
        name: "JK",
        type: "hls",
        embed: s.embed
      });
    }

    if (jk.length >= 6) break;
  }

  return jk;
}

export async function getAllServers ({ slug, number, title, env, language }: any) {
  const variants = Array.from(new Set([
    ...resolveSlugVariants(slug),
    ...resolveSlugVariants(title || "")
  ])).slice(0, 60);

  const [av1Result, jkResult, latinoResult] = await Promise.allSettled([
    collectAV1(variants, number),
    collectJK(variants, number, env),
    getLatinoProvidersServers(slug, number, variants)
  ]);

  const av1 = av1Result.status === "fulfilled" ? av1Result.value : [];
  const jk = jkResult.status === "fulfilled" ? jkResult.value : [];
  const latino = latinoResult.status === "fulfilled" ? latinoResult.value : [];

  // Ejecutado en paralelo, pero ordenado para priorizar AV1 al inicio.
  const ordered = language === "latino" ? [...av1, ...latino, ...jk] : [...av1, ...jk, ...latino];

  const normalized = await normalizeDirectOutput(ordered, "Dub");

  if (normalized.length) {
    return normalized.slice(0, 14);
  }

  return [];
}
