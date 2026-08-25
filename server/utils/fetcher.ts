const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
];

export function getHeaders(
  url: string,
  accept = "html",
) {
  const origin = new URL(url).origin;

  const ua =
    USER_AGENTS[
      Math.floor(
        Math.random() * USER_AGENTS.length,
      )
    ];

  return {
    "User-Agent": ua,

    "Accept":
      accept === "json"
        ? "application/json,text/plain,*/*"
        : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

    "Accept-Language":
      "es-ES,es;q=0.9,en;q=0.8",

    "Cache-Control": "no-cache",

    "Pragma": "no-cache",

    "Referer": `${origin}/`,
  };
}

export function looksLikeChallenge(
  text: string,
): boolean {
  const value = text.toLowerCase();

  return (
    value.includes("just a moment...") ||
    value.includes(
      "enable javascript and cookies to continue",
    ) ||
    value.includes("challenge-platform") ||
    value.includes("cf-chl-")
  );
}

export async function fetchHtml(
  url: string,
): Promise<string | null> {
  try {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      10000,
    );

    const response = await fetch(url, {
      method: "GET",
      headers: getHeaders(url),
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const text = await response.text();

    if (!text || text.length < 300) {
      return null;
    }

    if (looksLikeChallenge(text)) {
      return null;
    }

    return text;
  } catch {
    return null;
  }
}
