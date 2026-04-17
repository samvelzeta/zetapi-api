export async function getKVVideo(slug: string, ep: number, lang: string, env: any) {

  if (!env?.ANIME_CACHE) {
    console.log("❌ KV NO DISPONIBLE (GET)");
    return null;
  }

  const key = `${slug}:${ep}:${lang}`;

  try {
    const data = await env.ANIME_CACHE.get(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.log("❌ KV GET ERROR:", e);
    return null;
  }
}

export async function saveKVVideo(
  slug: string,
  ep: number,
  lang: string,
  payload: any,
  env: any
) {

  if (!env?.ANIME_CACHE) {
    console.log("❌ KV NO DISPONIBLE (SAVE)");
    return;
  }

  const key = `${slug}:${ep}:${lang}`;

  try {

    await env.ANIME_CACHE.put(
      key,
      JSON.stringify(payload),
      {
        // 🔥 AUMENTADO (ANTES 7 DÍAS)
        expirationTtl: 60 * 60 * 24 * 30 // 30 días
      }
    );

    console.log("💾 GUARDADO EN KV:", key);

  } catch (e) {
    console.log("❌ KV SAVE ERROR:", e);
  }
}
