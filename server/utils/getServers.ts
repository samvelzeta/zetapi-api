import {
  getAnimeFLVServers,
  getJKAnimeServers,
  getAnimeLHDServers,
  getMonosChinosServers
} from "./sources";

// 🔥 generar variantes del nombre
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

// 🔥 prioridad de servidores
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
}: {
  slug: string;
  number: number;
  title: string;
  lang: "sub" | "latino";
}) {

  let servers: any[] = [];

  const variants = generateVariants(title);

  // 🔥 FASE 1 (core)
  if (lang === "sub") {
    const [flv, jk] = await Promise.all([
      getAnimeFLVServers(slug, number),
      getJKAnimeServers(slug, number)
    ]);

    servers = [...flv, ...jk];
  }

  if (lang === "latino") {
    const [lhd, mono] = await Promise.all([
      getAnimeLHDServers(title),
      getMonosChinosServers(title)
    ]);

    servers = [...lhd, ...mono];
  }

  // 🔥 FASE 2 (fallback si vacío)
  if (!servers.length) {
    for (const variant of variants) {
      const fallback = await getAnimeLHDServers(variant);
      if (fallback.length) {
        servers.push(...fallback);
        break;
      }
    }
  }

  // 🔥 eliminar duplicados
  const unique = Array.from(
    new Map(
      servers
        .filter(s => s?.embed)
        .map(s => [s.embed, s])
    ).values()
  );

  return sortServers(unique);
}
