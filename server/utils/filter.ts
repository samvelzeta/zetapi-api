export async function filterWorkingServers(servers: any[]) {

  if (!servers?.length) return [];

  const clean = servers.filter(s => {

    if (!s?.embed) return false;

    const url = s.embed.toLowerCase();

    // ❌ basura
    if (
      url.includes("preview") ||
      url.includes("sample") ||
      url.includes("ads") ||
      url.includes(".css") ||
      url.includes(".js")
    ) return false;

    // ✔ HLS siempre válido
    if (url.includes(".m3u8")) return true;

    // ✔ MP4
    if (url.includes(".mp4")) return true;

    return true;
  });

  return clean.length ? clean : servers.slice(0, 3);
}
