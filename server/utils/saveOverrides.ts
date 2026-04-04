// server/utils/saveOverride.ts

export async function saveOverride(slug: string, url: string) {

  const token = process.env.GITHUB_TOKEN;

  if (!token) return;

  const path = `overrides/${slug}.json`;

  const apiUrl = `https://api.github.com/repos/samvelzeta/zetanime-cache/contents/${path}`;

  let sha = null;

  const existing = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (existing.ok) {
    const data = await existing.json();
    sha = data.sha;
  }

  const payload = {
    url,
    updated: Date.now()
  };

  await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: `override ${slug}`,
      content: Buffer.from(JSON.stringify(payload, null, 2)).toString("base64"),
      sha
    })
  });

  console.log(`🧠 override guardado: ${slug}`);
}
