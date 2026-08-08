import { fetchHtml } from "./fetcher";

function isZilla(url: string) {
  return url.includes("zilla-networks");
}

export async function scrapePage(url: string) {
  try {
    const html = await fetchHtml(url);
    if (!html) return [];
    const urls = html.match(/https?:\/\/[^"' ]+/g) || [];
    const servers: any[] = [];
    for (const u of urls) {
      if (!isZilla(u)) continue;
      servers.push({
        name: "Zilla",
        embed: u,
        type: "iframe",
      });
    }
    const unique = new Map<string, any>();
    for (const s of servers) {
      if (!unique.has(s.embed)) unique.set(s.embed, s);
    }
    return Array.from(unique.values());
  } catch {
    return [];
  }
}
