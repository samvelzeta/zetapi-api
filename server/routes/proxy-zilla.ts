export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const targetUrl = query.url as string;
  if (!targetUrl) throw createError({ statusCode: 400, message: "url required" });

  console.log("🔄 Proxy Zilla:", targetUrl);

  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": "https://animeav1.com/",
    },
  });

  let body = await response.text();
  const headers = new Headers(response.headers);
  headers.delete("x-frame-options");
  headers.delete("content-security-policy");
  headers.set("Access-Control-Allow-Origin", "*");

  console.log("✅ Proxy Zilla: status", response.status);

  return new Response(body, { status: response.status, headers });
});
