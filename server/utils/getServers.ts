import {
  getAnimeFLVServers,
  getJKAnimeServers,
  getTioAnimeServers,
  getAnimeIDServers,
  getAnimeYTServers,
  getAnimeFenixServers,
  getAnimeOnlineNinjaServers
} from "./sources";

export async function getAllServers({ slug, number, title, lang }) {
  let servers: any[] = [];

  // 🔥 SUB
  if (lang === "sub") {
    const [flv, jk] = await Promise.all([
      getAnimeFLVServers(slug, number),
      getJKAnimeServers(slug, number)
    ]);

    servers = [...flv, ...jk];
  }

  // 🔥 LATINO (TOP 5)
  if (lang === "latino") {
    const results = await Promise.all([
      getTioAnimeServers(title, number),
      getAnimeIDServers(title, number),
      getAnimeYTServers(title, number),
      getAnimeFenixServers(title, number),
      getAnimeOnlineNinjaServers(title)
    ]);

    servers = results.flat().filter(Boolean);
  }

  return Array.from(new Map(servers.map(s => [s.embed, s])).values());
}
