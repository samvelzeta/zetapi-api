import { getEpisode } from "animeflv-scraper";
import { fetchHtml } from "./fetcher";
import { resolveServer } from "./resolver";

// ======================
// 🔥 FETCH AV1 JSON
// ======================
async function fetchAV1Data(slug: string, number: number) {

  const url = `https://animeav1.com/media/${slug}/${number}/__data.json?x-sveltekit-invalidated=1`;

  try {

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 16; SM-A155M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 Chrome/147.0.7727.55 Mobile Safari/537.36",
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
// 🔥 PARSER AV1 REAL
// ======================
function parseAV1(json: any) {

  const servers: any[] = [];

  if (!json?.nodes) return servers;

  const raw = JSON.stringify(json.nodes);

  const strings =
    raw.match(/"(.*?)"/g)?.map(s => s.replace(/"/g, "")) || [];

  for (let i = 0; i < strings.length; i++) {

    const current = strings[i];
    const next = strings[i + 1];

    if (
      (current === "HLS" ||
        current === "Mega" ||
        current === "MP4Upload" ||
        current === "PDrain" ||
        current === "1Fichier") &&
      next?.startsWith("http")
    ) {

      servers.push({
        name: "animeav1",
        server: current,
        embed: next,
        type: current === "HLS" ? "hls" : "embed",
        lang: raw.includes('"DUB"') ? "latino" : "sub"
      });
    }
  }

  // 🔥 quitar duplicados
  const unique = new Map();
  for (const s of servers) {
    if (!unique.has(s.embed)) {
      unique.set(s.embed, s);
    }
  }

  return Array.from(unique.values());
}

// ======================
// 🔥 AV1 PRINCIPAL (EXPORTADO)
// ======================
export async function getAnimeAV1Servers(slug: string, number: number) {

  const json = await fetchAV1Data(slug, number);

  if (json) {

    const parsed = parseAV1(json);

    if (parsed.length) {

      const final: any[] = [];

      for (const s of parsed) {

        try {
          const resolved = await resolveServer(s.embed);

          if (resolved) {
            final.push({ ...s, embed: resolved });
          } else {
            final.push(s);
          }

        } catch {}
      }

      return final;
    }
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

        const decoded = decodeURIComponent(match[1]);
        const clean = decoded.replace(/\\/g, "");

        const resolved = await resolveServer(clean);

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
