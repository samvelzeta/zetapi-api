export async function filterWorkingServers(servers: any[]) {
  const results = await Promise.all(
    servers.map(async (s) => {
      try {
        const res = await fetch(s.embed, { method: "HEAD" });

        const type = res.headers.get("content-type") || "";

        if (
          type.includes("video") ||
          type.includes("mpegurl") ||
          type.includes("mp4") ||
          s.embed.includes("embed") // fallback
        ) {
          return s;
        }

        return null;
      } catch {
        return null;
      }
    })
  );

  return results.filter(Boolean);
}
