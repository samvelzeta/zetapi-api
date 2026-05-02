# Análisis rápido del repositorio

## ¿Qué es este proyecto?
Este repositorio implementa una **API REST no oficial de AnimeFLV** construida con **Nuxt/Nitro** y pensada para desplegarse sobre **Cloudflare Workers** (vía NuxtHub/Wrangler).

## Cómo está organizado
- `server/api/**`: endpoints principales (`anime`, `search`, `list`, y admin).
- `server/utils/**`: utilidades de scraping, resolución de servidores de video, filtros y caché KV.
- `server/routes/_openapi.json.get.ts`: genera y limpia el esquema OpenAPI para documentación pública.
- `app/pages/index.vue`: renderiza la documentación con Scalar usando el OpenAPI local.
- `server/routes/proxy.ts`: proxy para HLS/m3u8 y segmentos multimedia con cabeceras CORS.

## Flujo funcional (resumen)
1. Los endpoints consultan `animeflv-scraper` y/o utilidades propias.
2. Se valida `x-api-key` en varias rutas de API.
3. Para episodios, intenta primero leer de KV; si no hay caché, scrapea y luego guarda.
4. Se expone una documentación OpenAPI filtrada y ordenada para consumo externo.

## Conclusión
Sí: el repo se entiende como una API orientada a extraer/normalizar datos de AnimeFLV, incluyendo búsqueda, fichas de anime, episodios y resolución de fuentes de reproducción, con especial enfoque en CORS, proxy de streaming y caché.
