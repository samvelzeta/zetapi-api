import { fetchHtml } from "../fetcher";

export async function getAnimeFLVServers(slug: string, number: number) {

  try {

    const url = `https://www3.animeflv.net/ver/${slug}-${number}`;

    const html = await fetchHtml(url);
    if (!html) return [];

    const match = html.match(/var\s+videos\s*=\s*(\{.*?\});/s);

    if (!match) return [];

    const data = JSON.parse(match[1]);

    const servers: any[] = [];

    for (const key in data.SUB) {
      for (const s of data.SUB[key]) {
        servers.push({ embed: s.url });
      }
    }

    return servers;

  } catch {
    return [];
  }
}
