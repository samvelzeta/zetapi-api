const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export default {
  async fetch(request: Request) {

    // 🔥 MANEJO GLOBAL DE OPTIONS (CLAVE)
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

      const res = await fetch(target, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",

          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": target,
          "Origin": new URL(target).origin,
        }
      });

      const headers = new Headers();

      headers.set(
        "Content-Type",
        res.headers.get("content-type") || "text/html"
      );

      // 🔥 AQUÍ ES DONDE VAN LAS RESPUESTAS (esto preguntaste)
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "*");

      return new Response(res.body, {
        status: res.status,
        headers
      });

    } catch (err) {
      return new Response("Error en proxy", {
        status: 500,
        headers: corsHeaders,
      });
    }
  }
};
