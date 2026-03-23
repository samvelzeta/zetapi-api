import { getAllServers } from "../../../../utils/getServers";
import { filterWorkingServers } from "../../../../utils/filter";

export default defineEventHandler(async (event) => {

 // ðŸ”¥ CORS FIX
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (event.method === "OPTIONS") return "";

  const { slug, number } = getRouterParams(event) as { slug: string, number: string };

  const { lang } = getQuery(event) as { lang?: string };

  // ðŸ”¥ fallback idioma
  const language = lang === "latino" ? "latino" : "sub";

  // ðŸ”¥ title fallback (puedes mejorar luego)
  const title = slug.replace(/-/g, " ");

  const servers = await getAllServers({
    slug,
    number: Number(number),
    title,
    lang: language
  });

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
//nuevo
