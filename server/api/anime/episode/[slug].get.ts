import { getEpisode } from "animeflv-scraper";

export default defineCachedEventHandler(async (event) => {
  // 🌐 CORS
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key");

  // 🔥 PREFLIGHT
  if (event.method === "OPTIONS") {
    return {
      status: 200
    };
  }

  // 🔐 API KEY
  const apiKey = getHeader(event, "x-api-key");

  const envKey =
    process.env.API_KEY ||
    event.context.cloudflare?.env?.API_KEY;

  if (!envKey || apiKey !== envKey) {
    throw createError({ statusCode: 401 });
  }

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

  const detectLang = (name: string) => {
    const n = (name || "").toLowerCase();

    if (n.includes("lat") || n.includes("cast") || n.includes("esp") || n.includes("dub")) {
      return "latam";
    }
    if (n.includes("sub")) return "sub";

    return "unknown";
  };

  const numberMatch = slug.match(/(\d+)$/);
  const number = numberMatch ? Number(numberMatch[1]) : null;
  const cleanSlug = slug.replace(/-\d+$/, "");

  const base = await getEpisode(slug).catch(() => null);

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

  const allServers = [
    ...(base?.servers || []),
    ...monos,
    ...gogo,
    ...animeyt,
    ...ninja,
    ...animelhd
  ];

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
      embed,
      lang: detectLang(server?.name)
    };
  });

  servers = servers.filter(s => s.stream || s.embed);

  const priority: any = { hls: 1, mp4: 2, embed: 3 };
  servers.sort((a, b) => priority[a.type] - priority[b.type]);

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
