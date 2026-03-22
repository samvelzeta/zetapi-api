const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export default {
  async fetch(request: Request) {

    // 🔥 PRE-FLIGHT (SOLUCIONA FAILED TO FETCH)
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
          // 🔥 HEADERS MÁS REALES (IMPORTANTE)
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",

          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

          "Accept-Language": "en-US,en;q=0.9",

          // 🔥 CLAVE PARA EVITAR BLOQUEOS
          "Referer": parsed.origin,
          "Origin": parsed.origin,

          "Connection": "keep-alive",
        }
      });

      const headers = new Headers();

      // 🔥 IMPORTANTE: mantener content-type original
      headers.set(
        "Content-Type",
        res.headers.get("content-type") || "text/html"
      );

      // 🔥 CORS GLOBAL (ESTO ES LO QUE TE FALTABA ENTENDER)
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "*");

      // 🔥 OPCIONAL (MEJORA STREAM)
      headers.set("Cache-Control", "no-store");

      return new Response(res.body, {
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
