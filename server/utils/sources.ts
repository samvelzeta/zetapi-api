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
// 🔥 EXTRAER DIRECTO (SIN PARSE COMPLEJO)
// ======================
function extractFromJSON(json: any) {

  const latino: any[] = [];
  const sub: any[] = [];

  if (!json?.nodes) return { latino, sub };

  const raw = JSON.stringify(json.nodes);

  // 🔥 detectar idioma real
  const hasSUB = raw.includes('"SUB"'); // latino
  const hasDUB = raw.includes('"DUB"'); // japonés

  // 🔥 extraer zilla directo
  const urls =
    raw.match(/https?:\/\/player\.zilla-networks\.com\/play\/[a-z0-9]+/g) || [];

  for (const u of urls) {

    if (hasSUB) {
      latino.push({
        name: "animeav1",
        embed: u
      });
    }

    if (hasDUB) {
      sub.push({
        name: "animeav1",
        embed: u
      });
    }
  }

  return { latino, sub };
}

// ======================
// 🔥 AV1 PRINCIPAL (JSON + FALLBACK)
// ======================
export async function getAV1Servers(slug: string, number: number) {

  // 🔥 1. intentar JSON
  const json = await fetchAV1Data(slug, number);

  if (json) {

    const parsed = extractFromJSON(json);

    if (parsed.latino.length || parsed.sub.length) {
      return parsed;
    }
  }

  // 🔥 2. fallback a scraper (TU LOGICA ORIGINAL)
  const url = `https://animeav1.com/media/${slug}/${number}`;
  const scraped = await scrapePage(url);

  const latino: any[] = [];
  const sub: any[] = [];

  for (const s of scraped) {

    const u = s.embed || "";

    if (!u.includes("zilla-networks")) continue;

    // fallback duplicado (igual que ya hacías)
    latino.push({
      name: "animeav1",
      embed: u
    });

    sub.push({
      name: "animeav1",
      embed: u
    });
  }

  return { latino, sub };
}

// ======================
// 🔥 SCRAPER ORIGINAL (NO TOCADO)
// ======================
export async function scrapePage(url: string) {

  try {

    const html = await fetchHtml(url);
    if (!html) return [];

    const urls = html.match(/https?:\/\/[^"' ]+/g) || [];

    const servers: any[] = [];

    for (const u of urls) {

      if (
        u.includes("zilla-networks") ||
        u.includes("pixeldrain") ||
        u.includes("mega.nz") ||
        u.includes("mp4upload") ||
        u.includes("1fichier") ||
        u.includes("streamwish") ||
        u.includes("filemoon")
      ) {

        if (u.includes("zilla-networks")) {
          servers.push({
            name: "animeav1",
            embed: u
          });
          continue;
        }

        try {
          const resolved = await resolveServer(u);

          if (resolved) {
            servers.push({
              name: "animeav1",
              embed: resolved
            });
          }

        } catch {}
      }
    }

    const unique = new Map();

    for (const s of servers) {
      if (!unique.has(s.embed)) {
        unique.set(s.embed, s);
      }
    }

    return Array.from(unique.values());

  } catch {
    return [];
  }
}

// ======================
// 🔥 JKANIME (NO TOCADO)
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
            embed: resolved
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
// 🔥 ANIMEFLV (NO TOCADO)
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
            embed: resolved
          });
        }

      } catch {}
    }

    return servers;

  } catch {
    return [];
  }
}
