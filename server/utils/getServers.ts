import {
  getAnimeFLVServers,
  getJKAnimeServers,
  getAnimeLHDServers,
  getMonosChinosServers
} from "./sources";

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
//fix
  return Array.from(new Map(servers.map(s => [s.embed, s])).values());
}
