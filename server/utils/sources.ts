import { getEpisode } from "animeflv-scraper";
import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

// ======================
// 🔥 FETCH AV1 JSON
// ======================   sasd
async function fetchAV1Data(slug: string, number: number) {

  const url = `https://animeav1.com/media/${slug}/${number}/__data.json?x-sveltekit-invalidated=1`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Referer": `https://animeav1.com/media/${slug}/${number}`
      }
    });

    if (!res.ok) return null;

    return await res.json();

  } catch {
    return null;
  }
}

// ======================
// 🔥 PARSER REAL SVELTEKIT
// ======================
function parseAV1Nodes(json: any) {

  const servers: any[] = [];

  if (!json?.nodes) return servers;

  const raw = JSON.stringify(json.nodes);

  // valores (strings)
  const values = raw.match(/"(.*?)"/g)?.map(v => v.replace(/"/g, "")) || [];

  const matches = raw.match(/"server":\d+,"url":\d+/g);

  if (!matches) return servers;

  for (const m of matches) {

    const nums = m.match(/\d+/g);
    if (!nums || nums.length < 2) continue;

    const serverIndex = parseInt(nums[0]);
    const urlIndex = parseInt(nums[1]);

    const server = values[serverIndex];
    const url = values[urlIndex];

    if (!url) continue;

    servers.push({
      name: "animeav1",
      server,
      embed: url,
      type: server === "HLS" ? "hls" : "embed",
      lang: "sub"
    });
  }

  // 🔥 detectar idioma
  if (raw.includes("DUB")) {
    servers.forEach(s => {
      if (s.server === "HLS") {
        s.lang = "latino";
      }
    });
  }

  return servers;
}

// ======================
// 🔥 ANIMEAV1
// ======================
export async function getAnimeAV1Servers(slug: string, number: number) {

  const json = await fetchAV1Data(slug, number);

  if (json) {
    const parsed = parseAV1Nodes(json);
    if (parsed.length) return parsed;
  }

  return [];
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

    const players = [
      ...html.matchAll(/data-player="([^"]+)"/g)
    ];

    for (const match of players) {

      try {

        const decoded = Buffer.from(match[1], "base64").toString("utf-8");

        const resolved = await resolveServer(decoded);

        if (resolved) {
          servers.push({
            name: "jkanime",
            embed: resolved,
            lang: "sub"
          });
        }

      } catch {}
    }

    return servers;

  } catch {
    return [];
  }
}

// ======================
// 🔥 ANIMEFLV
// ======================
export async function getAnimeFLVServers(slug: string, number: number) {

  try {

    const data = await getEpisode({ anime: slug, episode: number });

    if (!data?.servers) return [];

    const servers: any[] = [];

    for (const s of data.servers) {

      try {

        const resolved = await resolveServer(s.url);

        if (resolved) {
          servers.push({
            name: "animeflv",
            embed: resolved,
            lang: "sub"
          });
        }

      } catch {}
    }

    return servers;

  } catch {
    return [];
  }
}
