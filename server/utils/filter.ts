export async function filterWorkingServers(servers: any[]) {

  if (!servers?.length) return [];

  const GOOD = [
    "streamwish",
    "filemoon",
    "streamtape",
    "mp4upload",
    "ok.ru",
    "dood"
  ];

  const BAD = [
    "facebook",
    "twitter",
    ".css",
    ".js",
    "ads"
  ];

  const clean = servers.filter(s => {

    if (!s?.embed) return false;

    const url = s.embed.toLowerCase();

    // 🔥 basura
    if (BAD.some(b => url.includes(b))) return false;

    // 🔥 HLS SIEMPRE PASA
    if (url.includes(".m3u8")) return true;

    // 🔥 MP4 válido
    if (url.includes(".mp4")) return true;

    // 🔥 servers conocidos
    if (GOOD.some(g => url.includes(g))) return true;

    return false;
  });

  if (!clean.length) {
    return servers.slice(0, 3);
  }

  return clean;
}
