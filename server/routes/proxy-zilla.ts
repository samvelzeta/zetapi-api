export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const targetUrl = query.url as string;
  if (!targetUrl) throw createError({ statusCode: 400, message: "url required" });

  // Fetch the Zilla page
  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": "https://animeav1.com/",
    },
  });

  let body = await response.text();

  // Remove X-Frame-Options and CSP headers that prevent embedding
  const headers = new Headers(response.headers);
  headers.delete("x-frame-options");
  headers.delete("content-security-policy");
  headers.set("Access-Control-Allow-Origin", "*");

  // Optionally rewrite resource URLs to go through our proxy (if needed)
  // body = body.replace(/(src|href)="https?:\/\/player\.zilla-networks\.com/g, '$1="/proxy-zilla?url=');

  return new Response(body, {
    status: response.status,
    headers,
  });
});
