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
  let origin = "";

  try {
    origin =
      new URL(url).origin;
  } catch {
    origin = "";
  }

  const ua =
    USER_AGENTS[
      Math.floor(
        Math.random() *
          USER_AGENTS.length,
      )
    ];

  return {
    "User-Agent":
      ua,

    "Accept":
      accept === "json"
        ? "application/json,text/plain,*/*"
        : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

    "Accept-Language":
      "es-ES,es;q=0.9,en;q=0.8",

    "Cache-Control":
      "no-cache",

    "Pragma":
      "no-cache",

    ...(origin
      ? {
          Referer:
            `${origin}/`,
        }
      : {}),
  };
}

export function looksLikeChallenge(
  text: string,
): boolean {
  const value =
    String(text || "")
      .toLowerCase();

  return (
    value.includes(
      "just a moment...",
    ) ||
    value.includes(
      "enable javascript and cookies to continue",
    ) ||
    value.includes(
      "challenge-platform",
    ) ||
    value.includes(
      "cf-chl-",
    ) ||
    value.includes(
      "checking your browser",
    ) ||
    value.includes(
      "verify you are human",
    )
  );
}

/**
 * Comprueba si el documento tiene suficiente contenido.
 */
function validHtml(
  text: string,
): boolean {
  if (!text) {
    return false;
  }

  /**
   * No descartamos páginas pequeñas
   * de forma exageradamente agresiva.
   */
  if (
    text.length < 100
  ) {
    return false;
  }

  return true;
}

/**
 * Fetch HTML genérico.
 */
export async function fetchHtml(
  url: string,
): Promise<string | null> {
  try {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        15000,
      );

    let response:
      Response;

    try {
      response =
        await fetch(
          url,
          {
            method: "GET",

            headers:
              getHeaders(
                url,
              ),

            redirect:
              "follow",

            signal:
              controller.signal,
          },
        );
    } finally {
      clearTimeout(
        timeout,
      );
    }

    if (
      !response.ok
    ) {
      console.warn(
        "[fetchHtml] HTTP",
        response.status,
        url,
      );

      return null;
    }

    const text =
      await response.text();

    if (
      !validHtml(
        text,
      )
    ) {
      console.warn(
        "[fetchHtml] HTML inválido:",
        url,
      );

      return null;
    }

    /**
     * IMPORTANTE:
     *
     * Un challenge no se puede resolver
     * con fetch normal.
     *
     * Lo devolvemos como null para que
     * Promise.allSettled permita continuar
     * con los demás scrapers.
     */
    if (
      looksLikeChallenge(
        text,
      )
    ) {
      console.warn(
        "[fetchHtml] Challenge detectado:",
        url,
      );

      return null;
    }

    return text;
  } catch (error) {
    console.warn(
      "[fetchHtml] Error:",
      url,
      error,
    );

    return null;
  }
}

/**
 * Fetch JSON.
 */
export async function fetchJson<T = any>(
  url: string,
): Promise<T | null> {
  try {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        15000,
      );

    try {
      const response =
        await fetch(
          url,
          {
            method: "GET",

            headers:
              getHeaders(
                url,
                "json",
              ),

            redirect:
              "follow",

            signal:
              controller.signal,
          },
        );

      if (
        !response.ok
      ) {
        console.warn(
          "[fetchJson] HTTP",
          response.status,
          url,
        );

        return null;
      }

      return (
        await response.json()
      ) as T;
    } finally {
      clearTimeout(
        timeout,
      );
    }
  } catch (error) {
    console.warn(
      "[fetchJson] Error:",
      url,
      error,
    );

    return null;
  }
}
