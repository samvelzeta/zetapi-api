import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

// ======================
// 🔥 HELPERS
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
// 🔥 AV1 SCRAPER (JSON + HTML)
// ======================
export async function scrapePage(url: string) {
  try {
    // 1. Intentar vía JSON (MÉTODO DATA.JSON)
    const jsonUrl = `${url.endsWith('/') ? url.slice(0, -1) : url}/__data.json`;
    const res = await fetch(jsonUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    
    if (res.ok) {
      const json = await res.json();
      const servers: any[] = [];
      const nodes = json.nodes || [];
      
      for (const node of nodes) {
        if (node?.data) {
          const epData = node.data.find((d: any) => d?.embeds);
          if (epData) {
            // En AV1: SUB suele ser Latino y DUB Japonés (Sub)
            if (epData.embeds.SUB) {
              epData.embeds.SUB.forEach((s: any) => {
                if (isZilla(s.url) || isHLS(s.url)) {
                  servers.push({ name: "Z", embed: s.url, lang: "latino" });
                }
              });
            }
            if (epData.embeds.DUB) {
              epData.embeds.DUB.forEach((s: any) => {
                if (isZilla(s.url) || isHLS(s.url)) {
                  servers.push({ name: "Z", embed: s.url, lang: "sub" });
                }
              });
            }
            if (servers.length) return servers;
          }
        }
      }
    }

    // 2. Fallback: Parseo de HTML (Tu código original mejorado)
    const html = await fetchHtml(url);
    if (!html) return [];

    const servers: any[] = [];
    const subBlock = html.split("SUB")[1]?.split("DUB")[0] || "";
    const dubBlock = html.split("DUB")[1] || "";

    const subUrls = extractUrls(subBlock);
    for (const u of subUrls) {
      if (isZilla(u)) servers.push({ name: "Z", embed: u, lang: "latino" });
      else if (isHLS(u)) servers.push({ name: "H", embed: u, lang: "latino" });
    }

    const dubUrls = extractUrls(dubBlock);
    for (const u of dubUrls) {
      if (isZilla(u)) servers.push({ name: "Z", embed: u, lang: "sub" });
      else if (isHLS(u)) servers.push({ name: "H", embed: u, lang: "sub" });
    }

    return servers;
  } catch {
    return [];
  }
}

// ======================
// 🔥 JKANIME
// ======================
export async function getJKAnimeServers(slug: string, number: number) {
  try {
    const url = `https://jkanime.net/${slug}/${number}/`;
    const html = await fetchHtml(url);
    if (!html) return [];

    const servers: any[] = [];
    const players = [...html.matchAll(/data-player="([^"]+)"/g)];

    for (const match of players) {
      try {
        const decoded = decodeURIComponent(match[1]).replace(/\\/g, "");
        const resolved = await resolveServer(decoded);
        if (resolved && resolved.includes(".m3u8")) {
          servers.push({ name: "K", embed: resolved, lang: "sub" });
        }
      } catch {}
    }
    return servers;
  } catch {
    return [];
  }
}
