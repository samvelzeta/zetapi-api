export async function filterWorkingServers(servers: any[]) {

  if (!servers?.length) return [];

  const BAD = [
    "/ver/",
    "/anime/",
    "/search",
    "facebook",
    "twitter",
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

  const clean: any[] = [];

  for (const s of servers) {

    if (!s?.embed) continue;

    const url = s.embed.toLowerCase();

    // ❌ basura REAL
    if (BAD.some(b => url.includes(b))) continue;

    // 🔥 TODO lo demás pasa (NO bloquear)
    clean.push(s);
  }

  // 🔥 CLAVE: nunca devolver vacío
  if (!clean.length) return servers;

  return clean;
}
