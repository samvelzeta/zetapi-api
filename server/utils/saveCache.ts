// server/utils/saveCache.ts

export async function saveCache(slug: string, number: number, lang: string, servers: any[]) {

  const token = process.env.GITHUB_TOKEN;
  if (!token) return;

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
      hls: [...new Set(hls)].slice(0, 5),
      mp4: [...new Set(mp4)].slice(0, 5),
      embed: [...new Set(embed)].slice(0, 5)
    },
    updated: Date.now()
  };

  const path = `data/${slug}/${number}-${lang}.json`;

  const apiUrl = `https://api.github.com/repos/samvelzeta/zetanime-cache/contents/${path}`;

  let sha = null;

  const existing = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${token}` }
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
      message: `cache ${slug} ep ${number}`,
      content: Buffer.from(JSON.stringify(payload, null, 2)).toString("base64"),
      sha
    })
  });

  console.log(`💾 cache guardado: ${slug} ep ${number}`);
}
