import { getEpisode } from "animeflv-scraper";

export default defineCachedEventHandler(async (event) => {
  // 🔐 API KEY
  const apiKey = getHeader(event, "x-api-key");
  if (apiKey !== process.env.API_KEY) {
    throw createError({
      statusCode: 401,
      message: "Unauthorized"
    });
  }

  // 🌐 CORS
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

  // 🔥 FUENTES
  const sources = await Promise.allSettled([
    getEpisode(slug, Number(number)).catch(() => null),

    // placeholders para otras páginas (estructura lista)
    (async () => null)(), // monoschinos
    (async () => null)(), // gogoanime
    (async () => null)(), // animeonline ninja
    (async () => null)(), // animeyt
    (async () => null)()  // animelhd
  ]);

  const valid = sources
    .filter((r: any) => r.status === "fulfilled" && r.value)
    .map((r: any) => r.value);

  if (!valid.length) {
    throw createError({
      statusCode: 404,
      message: "No se encontró el episodio"
    });
  }

  // 🔥 UNIFICAR SERVIDORES
  const allServers = valid.flatMap((s: any) => s.servers || []);

  const normalized = allServers.map((server: any) => {
    const embed = server?.embed || "";
    const download = server?.download || "";

    let type = "embed";

    if (embed.includes(".m3u8") || download.includes(".m3u8")) {
      type = "hls";
    } else if (embed.includes(".mp4") || download.includes(".mp4")) {
      type = "mp4";
    }

    return {
      name: server?.name,
      type,
      embed,
      download,
      stream:
        type === "hls"
          ? embed || download
          : type === "mp4"
          ? embed || download
          : null
    };
  });

  // 🔥 ELIMINAR DUPLICADOS
  const unique = Array.from(
    new Map(normalized.map((s: any) => [s.name + s.stream, s])).values()
  );

  return {
    success: true,
    totalServers: unique.length,
    data: {
      ...valid[0],
      servers: unique
    }
  };
}, {
  swr: false,
  maxAge: 86400,
  name: "episode",
  group: "anime",
  getKey: (event) => {
    const { slug, number } = getRouterParams(event) as { slug: string, number: string };
    return `${slug}-${number}`;
  }
});
