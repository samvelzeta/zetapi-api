import { getAllServers } from "../../../../utils/getServers";
import { filterWorkingServers } from "../../../../utils/filter";

function generateTitleVariants(slug: string) {
  const base = slug.replace(/-/g, " ");

  return [
    base,
    slug,
    base + " tv",
    base + " online"
  ];
}

export default defineEventHandler(async (event) => {

  setHeader(event, "Access-Control-Allow-Origin", "*");

  if (event.method === "OPTIONS") return "";

  const { slug, number } = getRouterParams(event) as { slug: string, number: string };
  const { lang } = getQuery(event) as { lang?: string };

  const language = lang === "latino" ? "latino" : "sub";

  const titles = generateTitleVariants(slug);

  let servers: any[] = [];

  for (const t of titles) {
    const result = await getAllServers({
      slug,
      number: Number(number),
      title: t,
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
