import { getLatinoProvidersDebug } from "../../utils/latinoProviders";
import { resolveSlugVariants } from "../../utils/slugResolver";

export default defineEventHandler(async (event) => {
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "POST,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (event.method === "OPTIONS") return "";

  const apiKey = getHeader(event, "x-api-key");
  const envKey = process.env.API_KEY || event.context.cloudflare?.env?.API_KEY;

  if (!envKey || apiKey !== envKey) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const body = await readBody(event);
  const slug = String(body?.slug || "").trim();
  const episode = Number(body?.episode || 0);

  if (!slug || !episode) {
    throw createError({ statusCode: 400, message: "slug y episode son requeridos" });
  }

  const variants = resolveSlugVariants(slug);
  const env = event.context.cloudflare?.env || (globalThis as any);
  const debug = await getLatinoProvidersDebug(slug, episode, variants, env);

  return {
    success: true,
    slug,
    episode,
    variants: variants.slice(0, 20),
    ...debug
  };
});
