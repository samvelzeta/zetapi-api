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

    // 🔥 HLS SIEMPRE PASA
    if (url.includes(".m3u8")) return true;

    if (BAD.some(b => url.includes(b))) return false;

    if (url.includes(".mp4")) return true;

    if (GOOD.some(g => url.includes(g))) return true;

    if (url.includes("embed") || url.includes("player")) return true;

    return false;
  });

  if (!clean.length) {
    return servers.slice(0, 5);
  }

  return clean;
}
