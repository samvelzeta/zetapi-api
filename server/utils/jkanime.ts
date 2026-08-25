import { fetchHtml } from "./fetcher";

export interface JKServer {
  name: string;
  url: string;
  type: "iframe";
}

interface RawJKServer {
  remote?: string;
  slug?: string;
  server?: string;
  lang?: number;
  size?: string;
  append?: number;
}

function extractServers(
  html: string,
): RawJKServer[] {
  const marker =
    "var servers =";

  const markerIndex =
    html.indexOf(marker);

  if (markerIndex < 0) {
    return [];
  }

  const start =
    html.indexOf(
      "[",
      markerIndex,
    );

  if (start < 0) {
    return [];
  }

  let depth = 0;
  let quote: string | null = null;
  let escaped = false;
  let end = -1;

  for (
    let i = start;
    i < html.length;
    i++
  ) {
    const ch = html[i];

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
    }

    if (ch === "]") {
      depth--;

      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end < 0) {
    return [];
  }

  const raw =
    html.slice(
      start,
      end,
    );

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function decodeRemote(
  remote: string,
): string | null {
  if (!remote) {
    return null;
  }

  try {
    const decoded =
      atob(remote);

    if (
      /^https?:\/\//i.test(
        decoded,
      )
    ) {
      return decoded;
    }
  } catch {}

  return null;
}

function buildJKPlayer(
  remote: string,
  server: string,
): string {
  return (
    "https://jkanime.net/jkplayer/c1" +
    `?u=${encodeURIComponent(remote)}` +
    `&s=${encodeURIComponent(
      server.toLowerCase(),
    )}`
  );
}

export async function getJKAnimeServers(
  slug: string,
  episode: number,
): Promise<JKServer[]> {
  const url =
    `https://jkanime.net/${slug}/${episode}/`;

  const html =
    await fetchHtml(url);

  if (!html) {
    return [];
  }

  const rawServers =
    extractServers(html);

  if (!rawServers.length) {
    return [];
  }

  const wanted =
    rawServers.filter(
      server => {
        const name =
          String(
            server.server ||
              "",
          ).toLowerCase();

        /*
         * VOLVEMOS A LA VERSIÓN QUE
         * YA FUNCIONABA:
         *
         * solo Desu + Magi
         */
        return (
          name === "desu" ||
          name === "magi"
        );
      },
    );

  const result: JKServer[] = [];

  const seen =
    new Set<string>();

  /*
   * Mantener Desu primero.
   */
  wanted.sort(
    (a, b) => {
      const A =
        String(
          a.server || "",
        ).toLowerCase();

      const B =
        String(
          b.server || "",
        ).toLowerCase();

      if (
        A === "desu" &&
        B !== "desu"
      ) {
        return -1;
      }

      if (
        B === "desu" &&
        A !== "desu"
      ) {
        return 1;
      }

      return 0;
    },
  );

  for (
    const server of wanted
  ) {
    const remote =
      decodeRemote(
        String(
          server.remote || "",
        ),
      );

    if (!remote) {
      continue;
    }

    const name =
      String(
        server.server || "",
      );

    const embed =
      buildJKPlayer(
        remote,
        name,
      );

    if (
      seen.has(embed)
    ) {
      continue;
    }

    seen.add(embed);

    result.push({
      name,
      url: embed,
      type: "iframe",
    });
  }

  return result;
}
