import { fetchHtml } from "../../utils/fetcher";
import { saveCache } from "../../utils/cache";

// ==============================
// 🔥 EXTRAER VIDEO
// ==============================
function extractVideo(html: string) {

  const urls = new Set<string>();

  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  m3u8?.forEach(u => urls.add(u));

  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  mp4?.forEach(u => urls.add(u));

  return Array.from(urls);
}

// ==============================
// 🔥 RESOLVER IFRAME
// ==============================
async function resolveIframe(url: string) {

  try {
    const html = await fetchHtml(url);
    if (!html) return null;

    const vids = extractVideo(html);

    return vids.length ? vids[0] : null;

  } catch {
    return null;
  }
}

// ==============================
// 🔥 SCRAPER DIRECTO JKANIME
// ==============================
async function scrapeFromUrl(url: string) {

  const servers: any[] = [];

  const html = await fetchHtml(url);
  if (!html) return [];

  // ======================
  // 🔥 DESU / MAGI (REAL)
  // ======================
  const players = [
    ...html.matchAll(/data-player="([^"]+)"/g)
  ];

  for (const p of players) {

    try {

      const decoded = decodeURIComponent(p[1]);
      const playerUrl = decoded.replace(/\\/g, "");

      const real = await resolveIframe(playerUrl);

      if (real) {
        servers.push({
          name: "override_hls",
          embed: real
        });
      }

    } catch {}
  }

  // ======================
  // 🔥 IFRAME FALLBACK
  // ======================
  const frames = [
    ...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)
  ].map(m => m[1]);

  for (const f of frames) {

    if (
      f.includes("facebook") ||
      f.includes("twitter") ||
      f.includes("disqus")
    ) continue;

    const real = await resolveIframe(f);

    if (real) {
      servers.push({
        name: "override_embed",
        embed: real
      });
    }
  }

  return servers;
}

// ==============================
// 🔥 HANDLER
// ==============================
export default defineEventHandler(async (event) => {

  const body = await readBody(event);

  const { slug, number, url } = body;

  if (!slug || !number || !url) {
    return {
      success: false,
      error: "missing params"
    };
  }

  console.log("🔥 OVERRIDE:", slug, number, url);

  // ======================
  // 🔥 SCRAPEAR URL DIRECTA
  // ======================
  const servers = await scrapeFromUrl(url);

  if (!servers.length) {
    return {
      success: false,
      error: "no servers found"
    };
  }

  // ======================
  // 🔥 CLASIFICAR
  // ======================
  const hls: string[] = [];
  const mp4: string[] = [];
  const embed: string[] = [];

  for (const s of servers) {

    const u = s.embed;

    if (!u) continue;

    if (u.includes(".m3u8")) hls.push(u);
    else if (u.includes(".mp4")) mp4.push(u);
    else embed.push(u);
  }

  const sources = {
    hls: Array.from(new Set(hls)).slice(0, 5),
    mp4: Array.from(new Set(mp4)).slice(0, 5),
    embed: Array.from(new Set(embed)).slice(0, 5)
  };

  // ======================
  // 🔥 GUARDAR CACHE (CLAVE)
  // ======================
  await saveCache(slug, Number(number), "sub", sources);

  return {
    success: true,
    total: servers.length,
    sources
  };
});
