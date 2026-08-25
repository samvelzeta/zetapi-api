export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

export function stripHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<[^>]*>/g, " ")
      .replace(/\\u0026/gi, "&")
      .replace(/\\n/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function extractBalanced(
  text: string,
  start: number,
  open: string,
  close: string,
): string | null {
  if (start < 0 || text[start] !== open) return null;

  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

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

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;

      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

export function extractAssignedObject(
  text: string,
  marker: string,
): string | null {
  const index = text.indexOf(marker);

  if (index < 0) return null;

  const start = text.indexOf("{", index + marker.length);

  if (start < 0) return null;

  return extractBalanced(text, start, "{", "}");
}

export function extractArrayAfter(
  text: string,
  marker: string,
): string | null {
  const index = text.indexOf(marker);

  if (index < 0) return null;

  const start = text.indexOf("[", index + marker.length);

  if (start < 0) return null;

  return extractBalanced(text, start, "[", "]");
}

export function getAttribute(
  tag: string,
  name: string,
): string | null {
  const escaped = name.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const match = tag.match(
    new RegExp(
      `${escaped}\\s*=\\s*["']([^"']*)["']`,
      "i",
    ),
  );

  return match ? decodeHtmlEntities(match[1]) : null;
}
