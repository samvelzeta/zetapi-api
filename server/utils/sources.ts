import { getEpisode } from "animeflv-scraper";
import { $fetch } from "ofetch";

// ======================
// 🔥 NORMALIZAR SERVIDOR
// =======================
function normalizeServer(name: string) {
  if (!name) return "server";

  const n = name.toLowerCase();

  if (n.includes("streamwish") || n.includes("sw")) return "streamwish";
  if (n.includes("filemoon")) return "filemoon";
  if (n.includes("streamtape")) return "streamtape";
  if (n.includes("mp4")) return "mp4upload";
  if (n.includes("ok.ru") || n.includes("okru")) return "okru";
  if (n.includes("netu")) return "netu";

  return "server"; // 🔥 ya no muestra jkanime ni fuente
}

// =====================
// 🔥 EXTRAER IFRAMES
// =====================
function extractIframes(html: string) {
  return [...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)].map(m => m[1]);
}

// =====================
// 🔥 DEEP RESOLVE RÁPIDO
// =====================
async function deepResolveFast(urls: string[]) {
  const checks = await Promise.allSettled(
    urls.map(async (u) => {

      if (
        u.includes("stream") ||
        u.includes("filemoon") ||
        u.includes("mp4")
      ) return u;

      try {
        const html = await $fetch(u, { timeout: 4000 });
        const frames = extractIframes(html);

        return frames.find(f =>
          f.includes("stream") ||
          f.includes("mp4")
        ) || null;

      } catch {
        return null;
      }
    })
  );

  return checks.find(r => r.status === "fulfilled" && r.value)?.value || null;
}

// =======================================================
// 🔥 LATINO (OPTIMIZADO)
// =======================================================

// 🥇 TIOANIME
export async function getTioAnimeServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://tioanime.com/buscar?q=${query}`);

    const match = search.match(/href="\/anime\/([^"]+)"/);
    if (!match) return [];

    const slug = match[1];

    const ep = await $fetch(`https://tioanime.com/ver/${slug}-${number}`);

    const frames = extractIframes(ep);

    const real = await deepResolveFast(frames);

    if (!real) return [];

    return [{ name: normalizeServer(real), embed: real }];

  } catch {
    return [];
  }
}

// 🥈 ANIMEID
export async function getAnimeIDServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animeid.tv/search?q=${query}`);

    const match = search.match(/href="\/anime\/([^"]+)"/);
    if (!match) return [];

    const slug = match[1];

    const ep = await $fetch(`https://animeid.tv/ver/${slug}/${number}`);

    const frames = extractIframes(ep);

    const real = await deepResolveFast(frames);

    if (!real) return [];

    return [{ name: normalizeServer(real), embed: real }];

  } catch {
    return [];
  }
}

// 🥉 ANIMEYT
export async function getAnimeYTServers(query: string, number: number) {
  try {
    const html = await $fetch(`https://animeyt.tv/?s=${query}`);

    const match = html.match(/href="([^"]+)"/);
    if (!match) return [];

    const page = await $fetch(match[1]);

    const frames = extractIframes(page);

    const real = await deepResolveFast(frames);

    if (!real) return [];

    return [{ name: normalizeServer(real), embed: real }];

  } catch {
    return [];
  }
}

// 🟡 ANIMEFENIX
export async function getAnimeFenixServers(query: string, number: number) {
  try {
    const html = await $fetch(`https://animefenix.com/search?q=${query}`);

    const match = html.match(/href="\/anime\/([^"]+)"/);
    if (!match) return [];

    const slug = match[1];

    const ep = await $fetch(`https://animefenix.com/ver/${slug}/${number}`);

    const frames = extractIframes(ep);

    const real = await deepResolveFast(frames);

    if (!real) return [];

    return [{ name: normalizeServer(real), embed: real }];

  } catch {
    return [];
  }
}

// =======================================================
// 🔥 SUB (NO TOCAR)
// =======================================================

export async function getAnimeFLVServers(slug: string, number: number) {
  try {
    const res = await getEpisode(slug, number);

    return (res?.servers || []).map((s: any) => ({
      name: normalizeServer(s.server || s.name),
      embed: s.url || s.embed
    }));

  } catch {
    return [];
  }
}

export async function getJKAnimeServers(slug: string, number: number) {
  try {
    const html = await $fetch(`https://jkanime.net/${slug}/${number}/`);

    const links = html.match(/https?:\/\/[^"]+/g) || [];

    return links.map(link => ({
      name: "jkanime",
      embed: link
    }));

  } catch {
    return [];
  }
}
