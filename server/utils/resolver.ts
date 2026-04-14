import { normalizeUrl } from "./serverTypes";

export async function resolveServer(rawUrl: string): Promise<string | null> {

  try {

    const url = normalizeUrl(rawUrl);
    if (!url) return null;

    return url;

  } catch {
    return rawUrl;
  }
}
