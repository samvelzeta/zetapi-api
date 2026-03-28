import { getAllServers } from "../../../../utils/getServers";
import { filterWorkingServers } from "../../../../utils/filter";

// ======================
// 🔥 VARIANTES BÁSICAS
// ======================
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

// ======================
// 🔥 MAIN
// ======================
export default defineEventHandler(async (event) => {

  setHeader(event, "Access-Control-Allow-Origin", "*");

  if (event.method === "OPTIONS") return "";

  const { slug, number } = getRouterParams(event);
  const { lang } = getQuery(event);

  const language = lang === "latino" ? "latino" : "sub";

  // ======================
  // 🔥 CACHE GITHUB (PRIMERO)
  // ======================
  const cacheUrl = `https://raw.githubusercontent.com/samvelzeta/zetanime-cache/main/data/${slug}/${number}.json`;

  try {
    const cached = await fetch(cacheUrl).then(r => r.json());

    if (cached?.sources?.length) {
      return {
        success: true,
        total: cached.sources.length,
        data: {
          slug,
          number: Number(number),
          servers: cached.sources
        }
      };
    }
  } catch (err) {
    // si falla cache → sigue normal
  }

  // ======================
  // 🔥 SCRAPING NORMAL
  // ======================
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

  // ======================
  // 🔥 FILTRO FINAL
  // ======================
  const working = await filterWorkingServers(servers);

  // ======================
  // 🔥 RESPUESTA
  // ======================
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
