export function getHeaders(url: string) {
  const origin = new URL(url).origin;
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
  ];
  const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
  return {
    "User-Agent": ua,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  };
}

export async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: getHeaders(url) });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.length < 500) return null;
    return text;
  } catch {
    return null;
  }
}
