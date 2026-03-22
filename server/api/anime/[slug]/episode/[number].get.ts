import { getEpisode } from "animeflv-scraper";

export default defineCachedEventHandler(async (event) => {
  const apiKey = getHeader(event, "x-api-key");
  if (apiKey !== process.env.API_KEY) {
    throw createError({ statusCode: 401 });
  }

  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "*");

  if (event.method === "OPTIONS") return;

  const { slug, number } = getRouterParams(event) as { slug: string, number: string };

  const fetchHTML = async (url: string) => {
    try {
      return await $fetch<string>(url, {
        headers: { "user-agent": "Mozilla/5.0" }
      });
    } catch {
      return null;
    }
  };

  // 🔥 1. ANIMEFLV
  const base = await getEpisode(slug, Number(number)).catch(() => null);

  // 🔥 2. MONOSCHINOS (REAL SCRAP)
  const monos = await (async () => {
    try {
      const url = `https://monoschinos2.com/ver/${slug}-${number}`;
      const html = await fetchHTML(url);
      if (!html) return [];

      const matches = [...html.matchAll(/iframe.*?src="(.*?)"/g)];

      return matches.map((m) => ({
        name: "monoschinos",
        embed: m[1]
      }));
    } catch {
      return [];
    }
  })();

  // 🔥 3. GOGOANIME (REAL SCRAP)
  const gogo = await (async () => {
    try {
      const url = `https://gogoanime3.co/${slug}-episode-${number}`;
      const html = await fetchHTML(url);
      if (!html) return [];

      const matches = [...html.matchAll(/iframe.*?src="(.*?)"/g)];

      return matches.map((m) => ({
        name: "gogoanime",
        embed: m[1]
      }));
    } catch {
      return [];
    }
  })();

  // 🔥 UNIFICAR SERVERS
  const allServers = [
    ...(base?.servers || []),
    ...monos,
    ...gogo
  ];

  // 🔥 RESOLVER
  const resolved = allServers.map((server: any) => {
    const embed = server.embed || "";
    const download = server.download || "";

    let type = "embed";
    let stream = null;

    if (embed.includes(".m3u8") || download.includes(".m3u8")) {
      type = "hls";
      stream = embed || download;
    } else if (embed.includes(".mp4") || download.includes(".mp4")) {
      type = "mp4";
      stream = embed || download;
    }

    return {
      name: server.name,
      type,
      stream,
      embed
    };
  });

  // 🔥 LIMPIAR
  const unique = Array.from(
    new Map(resolved.map((s) => [s.embed || s.stream, s])).values()
  );

  return {
    success: true,
    total: unique.length,
    data: {
      title: base?.title || slug,
      number: Number(number),
      servers: unique
    }
  };
});
