// REEMPLAZAR COMPLETO

import { getAllServers } from "../../../../utils/getServers";
import { filterWorkingServers } from "../../../../utils/filter";

function generateVariants(slug: string) {
  const base = slug.replace(/-/g, " ");

  return [
    base,
    slug,
    base + " tv",
    base + " online",
    base.replace("season", ""),
    base.replace(/\d+/g, "")
  ];
}

export default defineEventHandler(async (event) => {

  setHeader(event, "Access-Control-Allow-Origin", "*");

  if (event.method === "OPTIONS") return "";

  const { slug, number } = getRouterParams(event);
  const { lang } = getQuery(event);

  const language = lang === "latino" ? "latino" : "sub";

  const variants = generateVariants(slug);

  let servers: any[] = [];

  for (const title of variants) {
    const result = await getAllServers({
      slug,
      number: Number(number),
      title,
      lang: language
    });

    if (result.length) {
      servers = result;
      break;
    }
  }

  const working = await filterWorkingServers(servers);

  return {
    success: true,
    total: working.length,
    data: {
      slug,
      number: Number(number),
      servers: working
    }
  };
});
