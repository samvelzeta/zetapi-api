export default {
  async fetch(request: Request) {

    const url = new URL(request.url);
    const target = url.searchParams.get("url");

    if (!target) {
      return new Response("URL requerida", { status: 400 });
    }

    try {
      const res = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://www.google.com/",
          "Accept": "*/*"
        }
      });

      return new Response(res.body, {
        headers: {
          "Content-Type": res.headers.get("content-type") || "text/html",
          "Access-Control-Allow-Origin": "*"
        }
      });

    } catch (err) {
      return new Response("Error en proxy", { status: 500 });
    }
  }
};
