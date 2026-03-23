export async function filterWorkingServers(servers: any[]) {
  const results = await Promise.all(
    servers.map(async (s) => {
      try {
        await fetch(s.embed, { method: "GET" });
        return s;
      } catch {
        return null;
      }
    })
  );

  return results.filter(Boolean);
}
//fixxx
