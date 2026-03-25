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
    "/ver/",
    "/anime/",
    "/search",
    "facebook",
    "twitter",
    "ads",
    ".css",
    ".js"
  ];

  const clean = servers.filter(s => {

    if (!s?.embed) return false;

    const url = s.embed.toLowerCase();

    // ❌ basura directa
    if (BAD.some(b => url.includes(b))) return false;

    // ✔ buenos directos
    if (GOOD.some(g => url.includes(g))) return true;

    // ⚠️ fallback: si parece embed
    if (
      url.includes("embed") ||
      url.includes("player")
    ) return true;

    return false;
  });

  // 🔥 fallback si filtró todo
  if (!clean.length) {
    return servers.slice(0, 2); // no dejar vacío
  }

  return clean;
}
