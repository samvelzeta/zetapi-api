import { getJKAnimeServers, scrapePage } from "./sources";
import { resolveSlugVariants } from "./slugResolver";
import { findJKAnimeSlug } from "./jkSearch";

const PROXY = "https://zetapi-api.samvelzeta.workers.dev/proxy?url=";

function uniqueServers(list: any[]) {
  const seen = new Set();
  return list.filter(s => {
    if (!s?.embed) return false;
    const clean = s.embed.split("?")[0];
    if (seen.has(clean)) return false;
    seen.add(clean);
    return true;
  });
}

// Sensor para AV1
async function tryAV1(variants: string[], number: number, requestedLang: string) {
  for (const v of variants) {
    const url = `https://animeav1.com/media/${v}/${number}`;
    const scraped = await scrapePage(url);
    if (scraped.length) {
      // Intentamos priorizar el idioma solicitado
      const filtered = scraped.filter(s => s.lang === requestedLang);
      return filtered.length ? filtered : scraped;
    }
  }
  return [];
}

// Sensor para JK
async function tryJK(variants: string[], number: number, env: any) {
  for (const v of variants) {
    let jk = await getJKAnimeServers(v, number);
    if (!jk.length) {
      const realSlug = await findJKAnimeSlug(v, env);
      if (realSlug) jk = await getJKAnimeServers(realSlug, number);
    }
    if (jk.length) {
      return jk.map(s => ({
        ...s,
        type: "hls",
        embed: s.embed.includes("zilla") ? s.embed : `${PROXY}${encodeURIComponent(s.embed)}`,
        lang: "sub"
      }));
    }
  }
  return [];
}

// 🔥 FUNCIÓN PRINCIPAL EXPORTADA
export async function getAllServers({ slug, number, title, env, lang }: any) {
  const requestedLang = lang === "latino" ? "latino" : "sub";

  const variants = [
    slug,
    ...resolveSlugVariants(slug),
    ...resolveSlugVariants(title || "")
  ];

  // 1. Intentar AV1 (Sensor activado)
  let av1 = await tryAV1(variants, number, requestedLang);

  // 2. Intentar JK como Backup (Sensor activado)
  const jk = await tryJK(variants, number, env);

  // Prioridad final
  if (av1.length) {
    return uniqueServers([...av1, ...jk]).slice(0, 5);
  }

  if (jk.length) {
    return uniqueServers(jk).slice(0, 5);
  }

  return [];
}
