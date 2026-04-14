const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export default {
  async fetch(request: Request) {

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get("url");

    if (!target) {
      return new Response("URL requerida", {
        status: 400,
        headers: corsHeaders,
      });
    }

    try {

      const parsed = new URL(target);

      const res = await fetch(target, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",

          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9",

          "Referer": parsed.origin,
          "Origin": parsed.origin,

          "Connection": "keep-alive",
        }
      });

      const contentType = res.headers.get("content-type") || "";

      let body = res.body;

      // 🔥 REESCRIBIR M3U8 (CLAVE)
      if (contentType.includes("application/vnd.apple.mpegurl") || target.includes(".m3u8")) {

        const text = await res.text();

        const base = target.substring(0, target.lastIndexOf("/") + 1);

        const rewritten = text.replace(/(.*\.ts.*)/g, (line) => {
          if (line.startsWith("http")) {
            return `/proxy?url=${encodeURIComponent(line)}`;
          }
          return `/proxy?url=${encodeURIComponent(base + line)}`;
        });

        body = rewritten;
      }

      const headers = new Headers();

      headers.set(
        "Content-Type",
        contentType || "application/vnd.apple.mpegurl"
      );

      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "*");
      headers.set("Access-Control-Expose-Headers", "*");

      headers.set("Cache-Control", "no-store");

      return new Response(body, {
        status: res.status,
        headers,
      });

    } catch (err) {
      return new Response("Error en proxy", {
        status: 500,
        headers: corsHeaders,
      });
    }
  }
};
