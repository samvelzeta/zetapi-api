// server/utils/override.ts

export async function getOverride(slug: string) {
  try {
    const url = `https://raw.githubusercontent.com/samvelzeta/zetanime-cache/main/overrides/${slug}.json`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();

    if (!json?.url) return null;

    return json.url;

  } catch {
    return null;
  }
}
