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

    // ❌ basura real
    if (BAD.some(b => url.includes(b))) return false;

    // ✔ directos SIEMPRE
    if (url.includes(".m3u8") || url.includes(".mp4")) return true;

    // ✔ servers conocidos
    if (GOOD.some(g => url.includes(g))) return true;

    // ✔ embeds válidos
    if (
      url.includes("embed") ||
      url.includes("player")
    ) return true;

    return false;
  });

  // 🔥 fallback si se filtró todo
  if (!clean.length) {
    return servers.slice(0, 3);
  }

  return clean;
}
