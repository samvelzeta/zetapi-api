/**
 * Protect every API request with a server-side API key.
 *
 * The browser never receives this key. ZetaNimes calls ZetAPI through
 * Supabase Edge Functions, which attach the secret server-to-server.
 */
export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname;

  // Only protect API endpoints. Static assets and the public app shell stay untouched.
  if (path.startsWith("/_nuxt/") || path === "/favicon.ico") return;

  // CORS/preflight is safe to answer without credentials; data requests are not.
  setHeader(event, "Access-Control-Allow-Origin", "*");
  setHeader(event, "Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type, x-api-key, x-access-token, apikey, token, authorization");
  setHeader(event, "Access-Control-Expose-Headers", "Content-Type");

  if (event.method === "OPTIONS") return;

  // Cloudflare Workers secrets are exposed by Nitro through the Cloudflare env binding.
  // Keep API_KEY as a backwards-compatible fallback for the existing deployment.
  const env = (event.context as any).cloudflare?.env;
  const expectedKey =
    env?.ZET_API_KEY ||
    env?.API_KEY ||
    process.env.ZET_API_KEY ||
    process.env.API_KEY;

  const providedKey =
    getHeader(event, "x-api-key") ||
    getHeader(event, "x-access-token") ||
    getHeader(event, "apikey") ||
    getHeader(event, "token") ||
    getHeader(event, "authorization")?.replace(/^Bearer\s+/i, "");

  if (!expectedKey || !providedKey || providedKey !== expectedKey) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access Denied",
      message: "Access Denied",
    });
  }
});
