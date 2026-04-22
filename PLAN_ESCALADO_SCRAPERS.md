# Plan de escalado seguro para scrapers (Cloudflare-friendly)

## 1) Auditoría rápida del backend `server/`

### Núcleo actual (sí se está usando)
- `server/api/anime/[slug]/episode/[number].get.ts`: endpoint principal para resolver servidores por episodio, con lectura/escritura KV y llamada a `getAllServers`.
- `server/utils/getServers.ts`: pipeline actual AV1 + JK y fallback forzado cuando la lista final está vacía.
- `server/utils/sources.ts`: extractores de AV1 y JK.
- `server/utils/fetcher.ts`: fetch HTML con rotación de User-Agent.
- `server/utils/jkSearch.ts`: búsqueda de slug en JK con cache memoria/KV.
- `server/routes/proxy.ts`: proxy HLS/segmentos para CORS en reproducción.

### Posibles archivos muertos o incompletos (revisar antes de borrar)
- `server/api/admin/admin/override.post.ts` solo contiene un comentario (`//ssss...`), no lógica.
- `server/utils/filter.ts` exporta `filterWorkingServers` y no se usa en el flujo actual.
- `server/utils/serverTypes.ts` exporta `detectServerType` e `isValidVideo` sin uso visible en el pipeline principal.
- `server/utils/sources.ts` importa `getEpisode` pero no lo usa.

## 2) Problemas técnicos detectados (por qué puede fallar fallback)
- El fallback duro se activa **solo** si `final.length === 0`; si AV1 trae algo "no utilizable" para player, no entra fallback.
- JK filtra solo `.m3u8` en extractor; si la URL real sale tras un paso de resolución adicional, se descarta pronto.
- `fetchHtml` descarta respuestas cortas (`<500` chars), lo que puede provocar falsos vacíos.

## 3) Estrategia propuesta (sin romper producción)

### Fase A (bajo riesgo)
1. Definir `isPlayableServer()` y usarlo antes de decidir éxito.
2. Si AV1 retorna embeds pero **0 reproducibles**, disparar fallback en cascada (JK y siguientes).
3. Mantener respuesta actual (`{ success, data: { servers } }`) para no romper front.

### Fase B (paralelo real por fuentes)
1. Crear proveedores con interfaz común:
   - `provider.search(title|slug)`
   - `provider.getEpisodeServers(slug, ep)`
2. Ejecutar fuentes en paralelo controlado (ej. `Promise.allSettled` + límite de concurrencia 2-3).
3. Corte temprano cuando haya N servidores reproducibles.

### Fase C (sitios latinos prioritarios)
Objetivo: agregar proveedores para:
- `latanime.org`
- `latinoanime.net`
- `animelatinohd.com`

Notas prácticas:
- Muchos players cargan enlace final por JS/requests dinámicas, no siempre en HTML inicial.
- En Cloudflare Workers no hay navegador completo tipo Puppeteer; para “click virtual” conviene:
  - reproducir requests XHR detectables,
  - o usar un microservicio/headless externo opcional (solo para casos bloqueados).

### Fase D (normalización final para tu front)
- Excluir “mega”.
- Renombrar `name` a `"Dub"` cuando fuente sea doblada.
- Normalizar salida a:
  - `{ name: "Dub", type: "hls"|"mp4"|"embed", embed: "..." }`.

## 4) Revisión de repos públicos de extracción m3u8 (pedidos)

### `TroJanzHEX/Streams-Extractor`
- Enfocado a bot de Telegram para extraer pistas de archivos (audio/subs), no es un extractor web para players anime.
- Aporta poco al caso de scraping de páginas con JS anti-bot.

### `pratikkarbhal/m3u8_StreamSniper`
- Enfoque con Selenium headless + GitHub Actions para capturar `.m3u8` desde navegación.
- Útil como referencia de estrategia de detección, pero **no corre directo en Cloudflare Worker**.

### `MRKaZ/StreamTapeExtractor`
- Parsing específico de StreamTape (Regex + Jsoup/OkHttp).
- Útil como patrón de extractor por proveedor específico.

### `kuu/node-hls-stream`
- Sirve para consumir/extraer variantes de streams HLS ya conocidos.
- Útil para post-procesar m3u8, no para descubrir enlaces ocultos desde páginas JS complejas.

### `bashonly/yt-dlp-HLSTools`
- Plugin para playlists HLS genéricas difíciles en ecosistema `yt-dlp`.
- Muy útil como referencia de edge-cases HLS, pero su integración directa en Worker es limitada.

### `iddad/har-hls-extract`
- Extrae HLS desde archivo HAR y recompone con ffmpeg.
- Excelente para debug forense, no para tiempo real en tu API.

## 5) Orden recomendado de implementación
1. Hardening del pipeline actual (A).
2. Integrar primer proveedor latino (B + C en pequeño).
3. Medir tasa de éxito y tiempos.
4. Integrar segundo/tercer proveedor.
5. Reglas de normalización Dub + exclusión Mega.

## 6) Resultado esperado
- Menos dependencia de AV1.
- Fallback real cuando lo hallado no es reproducible.
- Mayor cobertura de anime latino con salida uniforme para tu player.
