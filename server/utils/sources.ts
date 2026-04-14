import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

// Helpers básicos
function isZilla(url: string) {
  return url.includes("zilla-networks.com");
}

function isHLS(url: string) {
  return url.includes(".m3u8");
}

function extractUrls(block: string) {
  return block.match(/https?:\/\/[^"' ]+/g) || [];
}

// 🔥 SCRAPER AV1 (JSON + HTML FALLBACK)
export async function scrapePage(url: string) {
  try {
    // 1. Intentar por JSON primero (más preciso para SUB/DUB)
    const jsonUrl = `${url}/__data.json`;
    const res = await fetch(jsonUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    
    if (res.ok) {
      const json = await res.json();
      const servers: any[] = [];
      const dataNodes = json.nodes || [];
      
      for (const node of dataNodes) {
        if (node?.data) {
          const epData = node.data.find((d: any) => d?.embeds);
          if (epData) {
            // AV1: SUB suele ser Latino, DUB suele ser Japonés subtitulado
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

    // 2. Fallback al HTML (tu código original mejorado)
    const html = await fetchHtml(url);
    if (!html) return [];

    const servers: any[] = [];
    const subBlock = html.split("SUB")[1]?.split("DUB")[0] || "";
    const dubBlock = html.split("DUB")[1] || "";

    const processBlock = (block: string, lang: string) => {
      extractUrls(block).forEach(u => {
        if (isZilla(u)) servers.push({ name: "Z", embed: u, lang });
        else if (isHLS(u)) servers.push({ name: "H", embed: u, lang });
      });
    };

    processBlock(subBlock, "latino");
    processBlock(dubBlock, "sub");

    return servers;
  } catch {
    return [];
  }
}

// 🔥 JKANIME (HLS)
export async function getJKAnimeServers(slug: string, number: number) {
  try {
    const url = `https://jkanime.net/${slug}/${number}/`;
    const html = await fetchHtml(url);
    if (!html) return [];

    const servers: any[] = [];
    const players = [...html.matchAll(/data-player="([^"]+)"/g)];

    for (const match of players) {
      const decoded = decodeURIComponent(match[1]).replace(/\\/g, "");
      const resolved = await resolveServer(decoded);
      if (resolved && resolved.includes(".m3u8")) {
        servers.push({ name: "K", embed: resolved, lang: "sub" });
      }
    }
    return servers;
  } catch {
    return [];
  }
}
