import {
  getAnimeFLVServers,
  getJKAnimeServers,
  getGogoServers,
  getHiAnimeServers,
  getAnimeFenixServers,
  getAnimeLHDServers,
  getMonosChinosServers,
  getTioAnimeServers,
  getAnimeIDServers
} from "./sources";

// variantes
function generateVariants(title: string) {
  const base = title.toLowerCase();

  return [
    base,
    base.replace(/ /g, "-"),
    base.replace(/ /g, "_"),
    base.replace("season", ""),
    base.replace(/\d+/g, "")
  ];
}

// prioridad
function sortServers(servers: any[]) {
  const priority = ["streamwish", "filemoon", "streamtape"];

  return servers.sort((a, b) => {
    return priority.indexOf(a.name) - priority.indexOf(b.name);
  });
}

export async function getAllServers({
  slug,
  number,
  title,
  lang
}: any) {

  let servers: any[] = [];
  const variants = generateVariants(title);

  // =====================
  // 🔥 JAPONES
  // =====================
  if (lang === "sub") {
    const core = await Promise.all([
      getAnimeFLVServers(slug, number),
      getJKAnimeServers(slug, number)
    ]);

    servers.push(...core.flat());

    if (!servers.length) {
      for (const v of variants) {
        const fallback = await Promise.all([
          getGogoServers(v),
          getHiAnimeServers(v),
          getAnimeFenixServers(v)
        ]);

        servers.push(...fallback.flat());
      }
    }
  }

  // =====================
  // 🔥 LATINO
  // =====================
  if (lang === "latino") {
    const core = await Promise.all([
      getAnimeLHDServers(title),
      getMonosChinosServers(title)
    ]);

    servers.push(...core.flat());

    if (!servers.length) {
      for (const v of variants) {
        const fallback = await Promise.all([
          getTioAnimeServers(v),
          getAnimeIDServers(v),
          getAnimeFenixServers(v)
        ]);

        servers.push(...fallback.flat());
      }
    }
  }

  // limpiar duplicados
  const unique = Array.from(
    new Map(
      servers
        .filter(s => s?.embed)
        .map(s => [s.embed, s])
    ).values()
  );

  return sortServers(unique);
}
