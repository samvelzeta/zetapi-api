import { scrapeSeekeEpisode, generateCacheKey } from "../../utils/seekeScraper";
import { getAllServers } from "../../utils/getServers";

export default defineEventHandler(async (event) => {

  const query = getQuery(event);

  const url = query.url as string;
  const ep = Number(query.ep || 1);
  const slug = query.slug as string | undefined;

  const env = event.context.cloudflare?.env;

  console.log(`🎬 Solicitud: ${url} EP ${ep}`);

  if (!url) {
    return {
      ok: false,
      error: "Falta URL"
    };
  }

  // ==============================
  // 🔥 GENERAR KEY (IMPORTANTE CAMBIO)
  // ==============================
  const cacheKey = await generateCacheKey(url, ep);

  // ==============================
  // 🔥 CACHE (VALIDACIÓN REAL)
  // ==============================
  try {

    if (env?.ANIME_CACHE) {

      const cached = await env.ANIME_CACHE.get(cacheKey);

      if (cached) {
        console.log(`⚡ CACHE HIT: ${cacheKey}`);

        const parsed = JSON.parse(cached);

        // 🔥 SOLO DEVOLVER SI ES VÁLIDO
        if (parsed.embed && parsed.embed.includes(".m3u8")) {
          return {
            ok: true,
            episode: ep,
            embed: parsed.embed,
            source: "cache",
            cached: true
          };
        }

        console.log("⚠️ Cache inválido ignorado");
      }
    }

  } catch (e) {
    console.log("❌ Error leyendo cache:", e);
  }

  // ==============================
  // 🔥 SEEKE SCRAPER (PRINCIPAL)
  // ==============================
  let result = await scrapeSeekeEpisode(url, ep);

  if (result && result.embed) {

    const response = {
      ok: true,
      episode: ep,
      embed: result.embed,
      source: "seeke",
      cached: false
    };

    // ==============================
    // 💾 GUARDAR SOLO SI ES VÁLIDO
    // ==============================
    try {

      if (env?.ANIME_CACHE) {

        if (result.embed.includes(".m3u8")) {

          await env.ANIME_CACHE.put(
            cacheKey,
            JSON.stringify(response),
            {
              expirationTtl: 60 * 60 * 24 * 30 // 30 días
            }
          );

          console.log(`💾 Guardado en cache: ${cacheKey}`);

        } else {
          console.log("⚠️ No se guarda cache (no válido)");
        }
      }

    } catch (e) {
      console.log("❌ Error guardando cache:", e);
    }

    return response;
  }

  // ==============================
  // 🔁 FALLBACK (AV1 / JK)
  // ==============================
  if (slug) {

    console.log("⚠️ Activando fallback...");

    try {

      const fallback = await getAllServers(slug, ep);

      return {
        ok: true,
        episode: ep,
        source: "fallback",
        data: fallback
      };

    } catch (e) {
      console.log("❌ Error fallback:", e);
    }
  }

  // ==============================
  // ❌ ERROR FINAL
  // ==============================
  return {
    ok: false,
    error: "No se pudo obtener el episodio"
  };

});
