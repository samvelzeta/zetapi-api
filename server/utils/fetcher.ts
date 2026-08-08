export function getHeaders(url: string): Headers {
  const headers = new Headers();
  headers.set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  headers.set("Accept-Language", "es-ES,es;q=0.9,en;q=0.8");
  headers.set("Referer", "https://jkanime.net/");
  return headers;
}

export async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: getHeaders(url),
      redirect: "follow",
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    const text = await response.text();
    console.log(`[FETCH] ${response.status} ${url} (${text.length} bytes)`);
    if (!response.ok) {
      console.log(`[FETCH ERROR] HTTP ${response.status}`);
      return null;
    }
    if (!text || text.length < 100) {
      console.log(`[FETCH ERROR] respuesta demasiado pequeña`);
      return null;
    }
    return text;
  } catch (error) {
    console.log(`[FETCH EXCEPTION] ${String(error)}`);
    return null;
  }
}
