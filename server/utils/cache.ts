// ======================
// 🔥 CACHE FETCH REAL
// ======================
export async function getCache(slug: string, number: number, lang: string) {

  try {

    const url = `https://raw.githubusercontent.com/samvelzeta/zetanime-cache/main/data/${slug}/${number}-${lang}.json`;

    const res = await fetch(url);

    if (!res.ok) return null;

    const json = await res.json();

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

// ======================
// 🔥 NUEVO: GUARDAR CACHE
// ======================
export async function saveCache(
  slug: string,
  number: number,
  lang: string,
  servers: any[]
) {

  try {

    // 🔥 separar por tipo
    const hls: string[] = [];
    const mp4: string[] = [];
    const embed: string[] = [];

    for (const s of servers) {
      const url = s.embed;

      if (!url) continue;

      if (url.includes(".m3u8")) hls.push(url);
      else if (url.includes(".mp4")) mp4.push(url);
      else embed.push(url);
    }

    const payload = {
      sources: {
        hls: Array.from(new Set(hls)).slice(0, 5),
        mp4: Array.from(new Set(mp4)).slice(0, 5),
        embed: Array.from(new Set(embed)).slice(0, 5)
      }
    };

    // ⚠️ NECESITAS TOKEN DE GITHUB
    const token = process.env.GITHUB_TOKEN;

    if (!token) return;

    const path = `data/${slug}/${number}-${lang}.json`;

    const apiUrl = `https://api.github.com/repos/samvelzeta/zetanime-cache/contents/${path}`;

    // 🔥 obtener SHA si existe
    let sha = null;

    const existing = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (existing.ok) {
      const data = await existing.json();
      sha = data.sha;
    }

    await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `update cache ${slug} ep ${number}`,
        content: Buffer.from(JSON.stringify(payload, null, 2)).toString("base64"),
        sha
      })
    });

  } catch (e) {
    // silencioso
  }
}
