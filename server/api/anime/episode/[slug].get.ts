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

  const { slug } = getRouterParams(event) as { slug: string };

  const fetchHTML = async (url: string) => {
    try {
      return await $fetch<string>(url, {
        headers: { "user-agent": "Mozilla/5.0" }
      });
    } catch {
      return null;
    }
  };

  const numberMatch = slug.match(/(\d+)$/);
  const number = numberMatch ? Number(numberMatch[1]) : null;
  const cleanSlug = slug.replace(/-\d+$/, "");

  // 🔥 BASE
  const base = await getEpisode(slug).catch(() => null);

  // 🔥 MONOSCHINOS
  const monos = await (async () => {
    try {
      if (!number) return [];
      const html = await fetchHTML(`https://monoschinos2.com/ver/${cleanSlug}-${number}`);
      if (!html) return [];
      return [...html.matchAll(/iframe.*?src="(.*?)"/g)].map(m => ({
        name: "monoschinos",
        embed: m[1]
      }));
    } catch {
      return [];
    }
  })();

  // 🔥 GOGOANIME
  const gogo = await (async () => {
    try {
      if (!number) return [];
      const html = await fetchHTML(`https://gogoanime3.co/${cleanSlug}-episode-${number}`);
      if (!html) return [];
      return [...html.matchAll(/iframe.*?src="(.*?)"/g)].map(m => ({
        name: "gogoanime",
        embed: m[1]
      }));
    } catch {
      return [];
    }
  })();

  // 🔥 ANIMEYT
  const animeyt = await (async () => {
    try {
      if (!number) return [];
      const html = await fetchHTML(`https://animeyt.tv/${cleanSlug}-${number}`);
      if (!html) return [];
      return [...html.matchAll(/iframe.*?src="(.*?)"/g)].map(m => ({
        name: "animeyt",
        embed: m[1]
      }));
    } catch {
      return [];
    }
  })();

  // 🔥 ANIMEONLINE NINJA
  const ninja = await (async () => {
    try {
      if (!number) return [];
      const html = await fetchHTML(`https://animeonline.ninja/${cleanSlug}-${number}`);
      if (!html) return [];
      return [...html.matchAll(/iframe.*?src="(.*?)"/g)].map(m => ({
        name: "ninja",
        embed: m[1]
      }));
    } catch {
      return [];
    }
  })();

  // 🔥 ANIMELHD
  const animelhd = await (async () => {
    try {
      if (!number) return [];
      const html = await fetchHTML(`https://animelhd.net/${cleanSlug}-${number}`);
      if (!html) return [];
      return [...html.matchAll(/iframe.*?src="(.*?)"/g)].map(m => ({
        name: "animelhd",
        embed: m[1]
      }));
    } catch {
      return [];
    }
  })();

  // 🔥 UNIFICAR TODO
  const allServers = [
    ...(base?.servers || []),
    ...monos,
    ...gogo,
    ...animeyt,
    ...ninja,
    ...animelhd
  ];

  // 🔥 RESOLVER
  let servers = allServers.map((server: any) => {
    const embed = server?.embed || "";
    const download = server?.download || "";

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
      name: server?.name,
      type,
      stream,
      embed
    };
  });

  // 🔥 LIMPIAR
  servers = servers.filter(s => s.stream || s.embed);

  // 🔥 ORDENAR
  const priority: any = { hls: 1, mp4: 2, embed: 3 };
  servers.sort((a, b) => priority[a.type] - priority[b.type]);

  // 🔥 UNIQUE
  const unique = Array.from(
    new Map(servers.map(s => [s.embed || s.stream, s])).values()
  );

  return {
    success: true,
    total: unique.length,
    data: {
      title: base?.title || slug,
      number,
      servers: unique
    }
  };
});
