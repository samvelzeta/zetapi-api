// 📁 server/utils/filter.ts

export async function filterWorkingServers(servers: any[]) {

  if (!servers?.length) return [];

  const GOOD = [
    "streamwish",
    "filemoon",
    "streamtape",
    "mp4upload",
    "ok.ru",
    "dood",
    "netu",
    "yourupload",
    "maru"
  ];

  const BAD = [
    "/ver/",
    "/anime/",
    "/search",
    "facebook",
    "twitter",
    "ads",
    ".css",
    ".js",
    "logo",
    "banner",
    "comment",
    "disqus",
    "captcha",
    "preview",
    "sample"
  ];

  const clean = servers.filter(s => {

    if (!s?.embed) return false;

    const url = s.embed.toLowerCase();

    // ❌ basura
    if (BAD.some(b => url.includes(b))) return false;

    // 🥇 HLS / MP4 directos
    if (url.includes(".m3u8") || url.includes(".mp4")) return true;

    // 🥈 servidores conocidos
    if (GOOD.some(g => url.includes(g))) return true;

    return false;
  });

  if (!clean.length) return servers.slice(0, 2);

  return clean;
}
