export default defineEventHandler(async (event) => {
  // 🌐 CORS
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "POST,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key");

  // 🔥 PREFLIGHT
  if (event.method === "OPTIONS") {
    return {
      status: 200
    };
  }

  // 🔐 API KEY
  const apiKey = getHeader(event, "x-api-key");

  const envKey =
    process.env.API_KEY ||
    event.context.cloudflare?.env?.API_KEY;

  if (!envKey || apiKey !== envKey) {
    throw createError({ statusCode: 401 });
  }

  const body = await readBody(event);

  const { slug, number, title } = body || {};

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: "Faltan datos"
    });
  }

  const request = {
    slug,
    number,
    title,
    createdAt: new Date().toISOString()
  };

  return {
    success: true,
    message: "Solicitud enviada",
    data: request
  };
});
