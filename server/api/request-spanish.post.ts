export default defineEventHandler(async (event) => {
  // 🔥 CORS FIX
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key");

  if (event.method === "OPTIONS") return "";

  const apiKey = getHeader(event, "x-api-key");
  const envKey = process.env.API_KEY || event.context.cloudflare?.env?.API_KEY;

  if (!envKey || apiKey !== envKey) {
    throw createError({ statusCode: 401 });
  }

  const body = await readBody(event);

  return {
    success: true,
    data: body
  };
});
