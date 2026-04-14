const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const PROXY_BASE = "https://zetapi-api.samvelzeta.workers.dev/proxy?url=";

export default {
  async fetch(request: Request) {

    // ============================ no se envivia
    // 🔥 PRE-FLIGHT
    // ============================
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
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept": "*/*",
          "Referer": parsed.origin,
          "Origin": parsed.origin,
        }
      });

      const contentType = res.headers.get("content-type") || "";

      // ============================
      // 🔥 HLS (M3U8) REWRITE COMPLETO
      // ============================
      if (contentType.includes("mpegurl") || target.includes(".m3u8")) {

        const text = await res.text();

        const base = target.substring(0, target.lastIndexOf("/") + 1);

        const lines = text.split("\n");

        const rewritten = lines.map(line => {

          // comentarios o vacíos
          if (!line || line.startsWith("#")) return line;

          let finalUrl = "";

          // 🔥 URL ABSOLUTA
          if (line.startsWith("http")) {
            finalUrl = line;
          } else {
            // 🔥 RELATIVA
            finalUrl = base + line;
          }

          return `${PROXY_BASE}${encodeURIComponent(finalUrl)}`;
        });

        return new Response(rewritten.join("\n"), {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Expose-Headers": "*",
            "Cache-Control": "no-store"
          }
        });
      }

      // ============================
      // 🔥 SEGMENTOS (.ts, .key, .mp4)
      // ============================
      return new Response(res.body, {
        status: res.status,
        headers: {
          "Content-Type": contentType || "application/octet-stream",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Expose-Headers": "*",
          "Cache-Control": "no-store"
        },
      });

    } catch (err) {
      return new Response("Error en proxy", {
        status: 500,
        headers: corsHeaders,
      });
    }
  }
};
