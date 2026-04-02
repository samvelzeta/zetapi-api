export async function filterWorkingServers(servers: any[]) {

  if (!servers?.length) return [];

  const clean = servers.filter(s => {

    if (!s?.embed) return false;

    const url = s.embed.toLowerCase();

    if (
      url.includes("preview") ||
      url.includes("sample") ||
      url.includes("ads") ||
      url.includes(".css") ||
      url.includes(".js")
    ) return false;

    return true;
  });

  return clean.length ? clean : servers.slice(0, 3);
}
