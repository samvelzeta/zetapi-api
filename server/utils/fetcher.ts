export function getHeaders(url: string): Record<string, string> {
  const origin = new URL(url).origin;
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  ];
  const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
  return {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Referer": `${origin}/`,
    "User-Agent": ua
  };
}

export async function fetchHtml(url: string, options?: RequestInit): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders(url),
      redirect: "follow",
      ...options
    });
    if (!res.ok) {
      console.log(`fetchHtml ${res.status}: ${url}`);
      return null;
    }
    const text = await res.text();
    if (!text || text.length < 300) return null;
    return text;
  } catch (e) {
    console.log("fetchHtml error:", e);
    return null;
  }
}
