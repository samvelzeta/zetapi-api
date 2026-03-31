// ======================
// 🔥 CACHE FETCH REAL
// ======================
export async function getCache(slug: string, number: number, lang: string) {

  try {

    const url = `https://raw.githubusercontent.com/samvelzeta/zetanime-cache/main/data/${slug}/${number}-${lang}.json`;

    const res = await fetch(url);

    if (!res.ok) return null;

    const json = await res.json();

    // ======================
    // 🔥 VALIDACIÓN FUERTE
    // ======================
    if (!json?.sources) return null;

    const hasData =
      (json.sources.hls && json.sources.hls.length) ||
      (json.sources.mp4 && json.sources.mp4.length) ||
      (json.sources.embed && json.sources.embed.length);

    if (!hasData) return null;

    return json;

  } catch {
    return null;
  }
}
