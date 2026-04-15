export async function getKVVideo(slug: string, ep: number, lang: string, env: any) {

  if (!env?.ANIME_CACHE) {
    console.log("❌ KV NO DISPONIBLE");
    return null;
  }

  const key = `${slug}:${ep}:${lang}`;

  const data = await env.ANIME_CACHE.get(key);

  return data ? JSON.parse(data) : null;
}

export async function saveKVVideo(
  slug: string,
  ep: number,
  lang: string,
  payload: any,
  env: any
) {

  if (!env?.ANIME_CACHE) {
    console.log("❌ KV NO DISPONIBLE PARA GUARDAR");
    return;
  }

  const key = `${slug}:${ep}:${lang}`;

  await env.ANIME_CACHE.put(
    key,
    JSON.stringify(payload),
    {
      expirationTtl: 60 * 60 * 24 * 7 // 7 días
    }
  );

  console.log("💾 GUARDADO EN KV:", key);
}
