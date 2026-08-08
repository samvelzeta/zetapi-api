import { fetchHtml } from "./fetcher";

function classifyUrl(url: string): string | null {
  if (url.includes("uns.bio")) return "UPNShare";
  if (url.includes("mp4upload.com")) return "MP4Upload";
  if (url.includes("mega.nz") || url.includes("mega.co.nz")) return "Mega";
  return null;   // Zilla ya no se extrae
}

export async function scrapePage(url: string) {
  try {
    const html = await fetchHtml(url);
    if (!html) return [];
    const urls = html.match(/https?:\/\/[^"' ]+/g) || [];
    const servers: any[] = [];
    for (const u of urls) {
      const type = classifyUrl(u);
      if (!type) continue;
      servers.push({
        name: type,
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
