export async function filterWorkingServers(servers: any[]) {
  return servers.filter(s =>
    s?.embed &&
    !s.embed.includes(".css") &&
    !s.embed.includes(".js") &&
    !s.embed.includes("logo") &&
    !s.embed.includes("banner")
  );
}
