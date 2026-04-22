// ==============================
// 🔥 HEADERS PRO (ANTI BLOQUEO REAL)
// ==============================
export function getHeaders (url: string) {
  const origin = new URL(url).origin;

  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/118 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 16; SM-A155M Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/147.0.7727.55 Mobile Safari/537.36"
  ];

  const ua = userAgents[Math.floor(Math.random() * userAgents.length)];

  return {
    "User-Agent": ua,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Connection": "keep-alive",
    "Referer": origin,
    "Origin": origin,
    "DNT": "1"
  };
}

type FetchHtmlOptions = {
  minLength?: number;
  retries?: number;
  timeoutMs?: number;
};

async function sleep (ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

// ==============================
// 🔥 FETCH HTML ROBUSTO
// ==============================
export async function fetchHtml (url: string, opts: FetchHtmlOptions = {}): Promise<string | null> {
  const {
    minLength = 120,
    retries = 2,
    timeoutMs = 9000
  } = opts;

  for (let i = 0; i <= retries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        headers: getHeaders(url),
        redirect: "follow",
        signal: ctrl.signal
      });

      if (!res.ok) {
        clearTimeout(timer);
        if (i < retries) {
          await sleep(250 * (i + 1));
          continue;
        }
        return null;
      }

      const text = await res.text();
      clearTimeout(timer);

      if (!text || text.length < minLength) {
        if (i < retries) {
          await sleep(250 * (i + 1));
          continue;
        }
        return null;
      }

      return text;
    }
    catch {
      clearTimeout(timer);
      if (i < retries) {
        await sleep(250 * (i + 1));
        continue;
      }
      return null;
    }
  }

  return null;
}
