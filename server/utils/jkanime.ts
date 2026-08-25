import { fetchHtml } from "./fetcher";

export interface JKServer {
  name: string;
  url: string;
  type:
    | "iframe"
    | "mp4";
}

function decodeUrl(
  value: string,
): string {
  return value
    .replace(
      /\\(["'\\])/g,
      "$1",
    )
    .replace(
      /\\u0026/gi,
      "&",
    )
    .trim();
}

function extractVideoAssignments(
  html: string,
): Array<{
  index: number;
  url: string;
}> {
  const results: Array<{
    index: number;
    url: string;
  }> = [];

  const regex =
    /video\s*\[\s*(\d+)\s*\]\s*=\s*["']?<iframe[^>]*src=["']([^"']+)["']/gi;

  let match:
    | RegExpExecArray
    | null;

  while (
    (match =
      regex.exec(html)) !== null
  ) {
    const index =
      Number(match[1]);

    const url =
      decodeUrl(
        match[2],
      );

    if (url) {
      results.push({
        index,
        url,
      });
    }
  }

  // Fallback para variaciones del script.
  if (!results.length) {
    const fallback =
      /video\s*\[\s*(\d+)\s*\][\s\S]{0,1200}?src=["']([^"']+)["']/gi;

    while (
      (match =
        fallback.exec(html)) !== null
    ) {
      results.push({
        index:
          Number(match[1]),
        url:
          decodeUrl(
            match[2],
          ),
      });
    }
  }

  const seen =
    new Set<string>();

  return results.filter(
    item => {
      if (
        seen.has(
          item.url,
        )
      ) {
        return false;
      }

      seen.add(
        item.url,
      );

      return true;
    },
  );
}

function extractServerNames(
  html: string,
): string[] {
  const names: string[] =
    [];

  const regex =
    /<div[^>]*id=["']reproductor-box["'][^>]*>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i;

  const container =
    html.match(regex)?.[1];

  if (!container) {
    return names;
  }

  const itemRegex =
    /<li\b[^>]*>[\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/li>/gi;

  let match:
    | RegExpExecArray
    | null;

  while (
    (match =
      itemRegex.exec(
        container,
      )) !== null
  ) {
    const text =
      match[1]
        .replace(
          /<[^>]*>/g,
          " ",
        )
        .replace(
          /\s+/g,
          " ",
        )
        .trim();

    if (text) {
      names.push(text);
    }
  }

  return names;
}

function serverName(
  index: number,
  names: string[],
  url = "",
): string {
  const lower =
    url.toLowerCase();

  if (
    lower.includes("desu")
  ) {
    return "Desu";
  }

  if (
    lower.includes("magi")
  ) {
    return "Magi";
  }

  const fromDom =
    names[index] || "";

  if (fromDom) {
    return fromDom;
  }

  if (index === 0) {
    return "Desu";
  }

  if (index === 1) {
    return "Magi";
  }

  return `Server ${index + 1}`;
}

function extractVarServers(
  html: string,
): any[] {
  const marker =
    "var servers =";

  const index =
    html.indexOf(marker);

  if (index < 0) {
    return [];
  }

  const start =
    html.indexOf(
      "[",
      index + marker.length,
    );

  if (start < 0) {
    return [];
  }

  let depth = 0;

  let quote:
    | string
    | null = null;

  let escaped = false;

  for (
    let i = start;
    i < html.length;
    i++
  ) {
    const ch =
      html[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === "\\") {
        escaped = true;
        continue;
      }

      if (ch === quote) {
        quote = null;
      }

      continue;
    }

    if (
      ch === '"' ||
      ch === "'"
    ) {
      quote = ch;
      continue;
    }

    if (ch === "[") {
      depth++;
    } else if (ch === "]") {
      depth--;

      if (depth === 0) {
        const raw =
          html.slice(
            start,
            i + 1,
          );

        try {
          return JSON.parse(
            raw,
          );
        } catch {
          return [];
        }
      }
    }
  }

  return [];
}

export async function getJKAnimeServers(
  slug: string,
  episode: number,
): Promise<JKServer[]> {
  const html =
    await fetchHtml(
      `https://jkanime.net/${slug}/${episode}/`,
    );

  if (!html) {
    return [];
  }

  const servers: JKServer[] =
    [];

  const seen =
    new Set<string>();

  const names =
    extractServerNames(
      html,
    );

  const iframes =
    extractVideoAssignments(
      html,
    );

  // Desu / Magi.
  for (
    const item of iframes
  ) {
    const fullUrl =
      item.url.startsWith(
        "http",
      )
        ? item.url
        : new URL(
            item.url,
            "https://jkanime.net/",
          ).toString();

    if (
      seen.has(fullUrl)
    ) {
      continue;
    }

    seen.add(fullUrl);

    servers.push({
      name: serverName(
        item.index,
        names,
        fullUrl,
      ),

      url: fullUrl,

      type: "iframe",
    });
  }

  // Fallbacks del objeto var servers.
  const rawServers =
    extractVarServers(
      html,
    );

  for (
    const item of rawServers
  ) {
    if (
      item?.server ===
      "YourUpload"
    ) {
      const remote =
        String(
          item.remote || "",
        );

      if (!remote) {
        continue;
      }

      const iframe =
        `https://jkanime.net/jkplayer/c1?u=${encodeURIComponent(remote)}&s=yourupload`;

      if (
        !seen.has(
          iframe,
        )
      ) {
        seen.add(iframe);

        servers.push({
          name:
            "YourUpload",
          url: iframe,
          type: "iframe",
        });
      }
    }

    if (
      item?.server ===
      "Mega"
    ) {
      let remote =
        String(
          item.remote || "",
        );

      try {
        remote =
          atob(remote);
      } catch {}

      if (
        remote.startsWith(
          "http",
        ) &&
        !seen.has(
          remote,
        )
      ) {
        seen.add(remote);

        servers.push({
          name: "Mega",
          url: remote,
          type: "mp4",
        });
      }
    }
  }

  const priority =
    (name: string) => {
      const n =
        name.toLowerCase();

      if (
        n.includes("desu")
      ) {
        return 0;
      }

      if (
        n.includes("magi")
      ) {
        return 1;
      }

      return 2;
    };

  servers.sort(
    (a, b) =>
      priority(a.name) -
      priority(b.name),
  );

  return servers;
}
