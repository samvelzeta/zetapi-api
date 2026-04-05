export async function filterWorkingServers(servers: any[]) {

  if (!servers?.length) return [];

  const GOOD = [
    "streamwish",
    "filemoon",
    "streamtape",
    "mp4upload",
    "ok.ru",
    "dood",
    "netu"
  ];

  const BAD = [
    "facebook",
    "twitter",
    "ads",
    ".css",
    ".js"
  ];

  const clean = servers.filter(s => {

    if (!s?.embed) return false;

    const url = s.embed.toLowerCase();

    // â Œ basura reallllllll
    if (BAD.some(b => url.includes(b))) return false;

    // âœ” directos SIEMPRE
    if (url.includes(".m3u8") || url.includes(".mp4")) return true;

    // âœ” servers conocidos
    if (GOOD.some(g => url.includes(g))) return true;

    // âœ” embeds válidos
    if (
      url.includes("embed") ||
      url.includes("player")
    ) return true;

    return false;
  });

  // ðŸ”¥ fallback si se filtró todo
  if (!clean.length) {
    return servers.slice(0, 3);
  }

  return clean;
}
