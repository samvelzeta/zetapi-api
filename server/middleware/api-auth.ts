/**
 * Bloquea toda la API y la portada. Solo ZetaNimes puede entrar mediante
 * el proxy del servidor que agrega ZET_API_KEY; la clave nunca llega al navegador.
 */
export default defineEventHandler((event) => {
  if (import.meta.prerender) return;

  const path = getRequestURL(event).pathname;
  if (path.startsWith("/_nuxt/") || path === "/favicon.ico") return;

  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key, x-access-token, apikey, token, authorization");
  setHeader(event, "Access-Control-Expose-Headers", "Content-Type");

  if (event.method === "OPTIONS") return;

  const env = (event.context as any).cloudflare?.env;
  const expectedKey = env?.ZET_API_KEY || env?.API_KEY || process.env.ZET_API_KEY || process.env.API_KEY;
  const providedKey =
    getHeader(event, "x-api-key") ||
    getHeader(event, "x-access-token") ||
    getHeader(event, "apikey") ||
    getHeader(event, "token") ||
    getHeader(event, "authorization")?.replace(/^Bearer\s+/i, "");

  if (!expectedKey || !providedKey || providedKey !== expectedKey) {
    throw createError({ statusCode: 403, statusMessage: "Access Denied", message: "Access Denied" });
  }
});
