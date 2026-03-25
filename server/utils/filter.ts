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

    // ❌ basura directas
    if (BAD.some(b => url.includes(b))) return false;

    // ✔ buenos directos
    if (GOOD.some(g => url.includes(g))) return true;

    // ⚠️ fallback suave
    if (
      url.includes("embed") ||
      url.includes("player")
    ) return true;

    return false;
  });

  // 🔥 limpiar JKAnime
  const jkFixed = cleanJKAnime(clean);

  // 🔥 limpiar AnimeFLV ligero
  const flvFixed = cleanAnimeFLV(jkFixed);

  // 🔥 fallback si filtró todo
  if (!flvFixed.length) {
    return servers.slice(0, 2);
  }

  return flvFixed;
}

// =====================
// 🔥 LIMPIEZA JKANIME
// =====================
function cleanJKAnime(servers: any[]) {
  const jk = servers.filter(s => s.name === "jkanime");
  const others = servers.filter(s => s.name !== "jkanime");

  if (!jk.length) return servers;

  const trimmed = jk.length > 1 ? jk.slice(1) : jk;

  const cleaned = trimmed.filter(s =>
    s.embed &&
    !s.embed.toLowerCase().includes("facebook") &&
    !s.embed.toLowerCase().includes("ads") &&
    !s.embed.toLowerCase().includes("track")
  );

  return [...cleaned, ...others];
}

// =====================
// 🔥 LIMPIEZA ANIMEFLV (SUAVE)
// =====================
function cleanAnimeFLV(servers: any[]) {

  return servers.filter(s => {

    if (!s?.embed) return false;

    const url = s.embed.toLowerCase();

    // ❌ eliminar vacíos típicos
    if (
      url.includes("error") ||
      url.includes("blank") ||
      url.length < 20
    ) return false;

    return true;
  });
}
