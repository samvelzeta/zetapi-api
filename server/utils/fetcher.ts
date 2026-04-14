export function getHeaders(url: string) {

  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/118 Safari/537.36"
  ];

  const ua = userAgents[Math.floor(Math.random() * userAgents.length)];export function getHeaders(url: string) {

  return {
    "User-Agent":
      "Mozilla/5.0 (Linux; Android 16; SM-A155M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Connection": "keep-alive",
    "Referer": "https://animeav1.com/",
    "Origin": "https://animeav1.com"
  };
}

export async function fetchHtml(url: string): Promise<string | null> {

  try {

    const res = await fetch(url, {
      headers: getHeaders(url)
    });

    if (!res.ok) return null;

    const text = await res.text();

    return text;

  } catch {
    return null;
  }
}

  return {
    "User-Agent": ua,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Referer": new URL(url).origin,
    "Origin": new URL(url).origin
  };
}

// 🔥 fetch reutilizable
export async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: getHeaders(url)
    });

    const text = await res.text();

    if (!text || text.length < 800) return null;

    return text;

  } catch {
    return null;
  }
}
