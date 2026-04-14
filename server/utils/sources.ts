import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

// ======================
// HELPERS
// ======================
function isZilla(url: string) {
  return url.includes("zilla-networks");
}

function isHLS(url: string) {
  return url.includes(".m3u8");
}

function extractUrls(block: string) {
  return block.match(/https?:\/\/[^"' ]+/g) || [];
}

// ======================
// 🔥 SCRAPER AV1 MEJORADO (SIN ROMPER)
// ======================
export async function scrapePage(url: string) {

  try {

    const html = await fetchHtml(url);
    if (!html) return [];

    const servers: any[] = [];

    // ======================
    // 🔥 DETECTAR BLOQUES REALES
    // ======================

    // SUB (LATINO)
    const subBlock = html.includes("SUB")
      ? html.split("SUB")[1]?.split("DUB")[0] || ""
      : "";

    // DUB (JAPONES)
    const dubBlock = html.includes("DUB")
      ? html.split("DUB")[1] || ""
      : "";

    // ======================
    // 🟢 SUB → LATINO
    // ======================
    const subUrls = extractUrls(subBlock);

    for (const u of subUrls) {

      // 🔥 prioridad ZILLA
      if (isZilla(u)) {
        servers.push({
          name: "Z",
          embed: u,
          lang: "latino"
        });
        continue;
      }

      // 🔥 HLS REAL
      if (isHLS(u)) {
        servers.push({
          name: "H",
          embed: u,
          lang: "latino"
        });
      }
    }

    // ======================
    // 🔵 DUB → SUB (JAPONES)
    // ======================
    const dubUrls = extractUrls(dubBlock);

    for (const u of dubUrls) {

      if (isZilla(u)) {
        servers.push({
          name: "Z",
          embed: u,
          lang: "sub"
        });
        continue;
      }

      if (isHLS(u)) {
        servers.push({
          name: "H",
          embed: u,
          lang: "sub"
        });
      }
    }

    // ======================
    // 🔥 FALLBACK (SI NO DETECTA BLOQUES)
    // ======================
    if (!servers.length) {

      const allUrls = extractUrls(html);

      for (const u of allUrls) {

        if (isZilla(u)) {
          servers.push({
            name: "Z",
            embed: u,
            lang: "latino"
          });
          continue;
        }

        if (isHLS(u)) {
          servers.push({
            name: "H",
            embed: u,
            lang: "sub"
          });
        }
      }
    }

    // ======================
    // 🔥 UNIQUE
    // ======================
    const seen = new Set();

    return servers.filter(s => {
      if (seen.has(s.embed)) return false;
      seen.add(s.embed);
      return true;
    });

  } catch {
    return [];
  }
}

// ======================
// 🔥 JKANIME (NO TOCAR MUCHO)
// ======================
export async function getJKAnimeServers(slug: string, number: number) {

  try {

    const url = `https://jkanime.net/${slug}/${number}/`;
    const html = await fetchHtml(url);

    if (!html) return [];

    const servers: any[] = [];

    const players = [
      ...html.matchAll(/data-player="([^"]+)"/g)
    ];

    for (const match of players) {

      try {

        const decoded = decodeURIComponent(match[1]);
        const clean = decoded.replace(/\\/g, "");

        const resolved = await resolveServer(clean);
        if (!resolved) continue;

        if (!resolved.includes(".m3u8")) continue;

        servers.push({
          name: "K",
          embed: resolved,
          lang: "sub"
        });

      } catch {}
    }

    return servers;

  } catch {
    return [];
  }
}
