// ==============================
// 🔥 KV FALLBACK (EPISODIOS)
// ==============================

export async function getKVVideo(
  slug: string,
  number: number,
  lang: string,
  env?: any
) {
  try {
    if (!env?.VIDEO_KV) return null;

    const key = `${slug}:${number}:${lang}`;
    const data = await env.VIDEO_KV.get(key, "json");

    if (!data) return null;

    return data;
  } catch {
    return null;
  }
}

// ==============================
export async function saveKVVideo(
  slug: string,
  number: number,
  lang: string,
  payload: any,
  env?: any
) {
  try {
    if (!env?.VIDEO_KV) return;

    const key = `${slug}:${number}:${lang}`;

    await env.VIDEO_KV.put(
      key,
      JSON.stringify({
        ...payload,
        updated: Date.now()
      })
    );

  } catch {}
}
