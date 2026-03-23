import { $fetch } from "ofetch";

// =====================
// 🔥 DETECTAR SERVER
// =====================
function detectServer(url: string) {
  const u = url.toLowerCase();

  if (u.includes("streamwish")) return "streamwish";
  if (u.includes("filemoon")) return "filemoon";
  if (u.includes("streamtape")) return "streamtape";
  if (u.includes("dood")) return "doodstream";
  if (u.includes("ok.ru")) return "okru";
  if (u.includes("jkanime")) return "jkanime";

  return "unknown";
}

// =====================
// 🔥 LIMPIAR LINKS
// =====================
function cleanLinks(links: string[]) {
  return [...new Set(links)];
}

// =====================
// 🔥 MULTI MATCH UTILS
// =====================
function extractMatches(html: string, regex: RegExp) {
  return [...html.matchAll(regex)].map((m) => m[1]);
}

// =====================
// 🔥 TIOANIME
// =====================
export async function getTioAnimeServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://tioanime.com/buscar?q=${query}`);

    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 5)) {
      const epUrl = `https://tioanime.com/ver/${slug}-${number}`;
      const html = await $fetch(epUrl);

      const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
      if (iframe?.[1]) {
        return [{
          name: detectServer(iframe[1]),
          embed: iframe[1]
        }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// =====================
// 🔥 ANIMEID
// =====================
export async function getAnimeIDServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animeid.tv/search?q=${query}`);

    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 5)) {
      const epUrl = `https://animeid.tv/ver/${slug}/${number}`;
      const html = await $fetch(epUrl);

      const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
      if (iframe?.[1]) {
        return [{
          name: detectServer(iframe[1]),
          embed: iframe[1]
        }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// =====================
// 🔥 ANIMEFENIX
// =====================
export async function getAnimeFenixServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animefenix.com/search?q=${query}`);

    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 5)) {
      const epUrl = `https://animefenix.com/ver/${slug}/${number}`;
      const html = await $fetch(epUrl);

      const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
      if (iframe?.[1]) {
        return [{
          name: detectServer(iframe[1]),
          embed: iframe[1]
        }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// =====================
// 🔥 MONOSCHINOS
// =====================
export async function getMonosChinosServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://monoschinos2.com/buscar?q=${query}`);

    const matches = extractMatches(search, /href="\/ver\/([^"]+)"/g);

    for (const slug of matches.slice(0, 5)) {
      const html = await $fetch(`https://monoschinos2.com/ver/${slug}`);

      const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
      if (iframe?.[1]) {
        return [{
          name: detectServer(iframe[1]),
          embed: iframe[1]
        }];
      }
    }

    return [];
  } catch {
    return [];
  }
}

// =====================
// 🔥 ANIMELHD
// =====================
export async function getAnimeLHDServers(query: string, number: number) {
  try {
    const search = await $fetch(`https://animelhd.com/search?q=${query}`);

    const matches = extractMatches(search, /href="\/anime\/([^"]+)"/g);

    for (const slug of matches.slice(0, 5)) {
      const html = await $fetch(`https://animelhd.com/ver/${slug}/${number}`);

      const iframe = html.match(/<iframe[^>]+src="([^"]+)"/);
      if (iframe?.[1]) {
        return [{
          name: detectServer(iframe[1]),
          embed: iframe[1]
        }];
      }
    }

    return [];
  } catch {
    return [];
  }
}
