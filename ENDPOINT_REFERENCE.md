# 📊 ENDPOINT REFERENCE

## 🚀 ENDPOINTS DISPONIBLES

### 1. **NUEVO ENDPOINT (RECOMENDADO)**

```
GET /api/anime/episode-seeke?url=BASE_URL&ep=NUM
```

**Propósito:** Scraping directo con Seeke/clones + fallback automático

**Parámetros:**
- `url` (requerido): URL base del anime sin episodio
- `ep` (requerido): Número del episodio
- `slug` (opcional): Para fallback legacy

**Ejemplo:**
```bash
curl "http://localhost:3000/api/anime/episode-seeke?url=https://example.com/anime/naruto&ep=5"
```

**Response:**
```json
{
  "ok": true,
  "episode": 5,
  "embed": "https://cdn.example.com/videos/ep5.m3u8",
  "source": "seeke",
  "url": "https://example.com/anime/naruto",
  "cached": false
}
```

---

### 2. **ENDPOINT LEGACY MEJORADO**

```
GET /api/anime/[slug]/episode/[number]?lang=sub&url=BASE_URL
```

**Propósito:** Compatibilidad con sistema viejo + SEEKE como prioritario

**Parámetros:**
- `lang`: `sub` (default) o `latino`
- `url`: (opcional) URL base para intentar SEEKE primero

**Ejemplo:**
```bash
# Sin SEEKE (método legacy)
curl "http://localhost:3000/api/anime/naruto/episode/5?lang=sub"

# Con SEEKE (intenta primero SEEKE, luego legacy)
curl "http://localhost:3000/api/anime/naruto/episode/5?lang=sub&url=https://example.com/anime/naruto"
```

**Response:**
```json
{
  "success": true,
  "source": "seeke",
  "data": {
    "slug": "naruto",
    "number": 5,
    "servers": [
      { "embed": "https://...m3u8" }
    ]
  }
}
```

---

## 🎯 DECISIÓN: CUÁL USAR

| Caso | Endpoint | Razón |
|------|----------|-------|
| Frontend Lovable nuevo | `/api/anime/episode-seeke` | ✅ Respuesta JSON limpia |
| Compatibilidad legacy | `/api/anime/[slug]/episode/[number]` | ✅ Mantiene compatibilidad |
| Apps existentes | `/api/anime/[slug]/episode/[number]` | ✅ No rompes nada |

---

## 📝 VARIABLES DE LOVABLE

```javascript
// En tu frontend/store/animes.js o component

const API_BASE = 'https://tu-api.com'; // O localhost:3000 en dev

// Opción 1: Nuevo endpoint (recomendado)
export async function getEpisodeSeeke(baseUrl, episodeNumber) {
  const url = `${API_BASE}/api/anime/episode-seeke?url=${encodeURIComponent(baseUrl)}&ep=${episodeNumber}`;
  return fetch(url).then(r => r.json());
}

// Opción 2: Legacy endpoint con SEEKE
export async function getEpisodeLegacy(slug, episodeNumber, language = 'sub', baseUrl = null) {
  let url = `${API_BASE}/api/anime/${slug}/episode/${episodeNumber}?lang=${language}`;
  if (baseUrl) {
    url += `&url=${encodeURIComponent(baseUrl)}`;
  }
  return fetch(url).then(r => r.json());
}

// Uso en componente
const data = await getEpisodeSeeke('https://example.com/anime/naruto', 5);
initPlayer(data.embed);
```

---

## ⚙️ CONFIGURACIÓN EN CLOUDFLARE

Si usas Cloudflare Workers, asegúrate de:

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "ANIME_CACHE"
id = "tu-kv-id"
```

---

## 🔄 FLUJO DE SCRAPING

```
LOVABLE
  ↓
GET /api/anime/episode-seeke?url=...&ep=5
  ↓
seekeScraper.ts
  ├─ Verificar página (HEAD request)
  ├─ Extraer m3u8 del HTML (3 búsquedas)
  ├─ Validar m3u8 accesible
  └─ Retornar
  ↓
KV Cache (opcional)
  ↓
JSON Response
  ↓
HLS.js Player
  ↓
🎬 REPRODUCIR
```

---

## 🧪 TEST RÁPIDO

```bash
# 1. Test endpoint nuevo
curl -X GET "http://localhost:3000/api/anime/episode-seeke?url=https://example.com/anime/test&ep=1" | jq

# 2. Test endpoint legacy
curl -X GET "http://localhost:3000/api/anime/test/episode/1?lang=sub" | jq

# 3. Test con ambos (mejor)
curl -X GET "http://localhost:3000/api/anime/test/episode/1?lang=sub&url=https://example.com/anime/test" | jq
```

---

## 📊 RESPUESTAS ESPERADAS

**✅ ÉXITO SEEKE:**
```json
{
  "ok": true,
  "episode": 5,
  "embed": "https://cdn.example.com/videos/ep5.m3u8",
  "source": "seeke",
  "cached": false
}
```

**⚡ DESDE CACHE:**
```json
{
  "ok": true,
  "episode": 5,
  "embed": "https://...",
  "source": "seeke",
  "cached": true
}
```

**📺 FALLBACK LEGACY:**
```json
{
  "success": true,
  "source": "scraper",
  "data": {
    "slug": "naruto",
    "servers": [...]
  }
}
```

**❌ ERROR:**
```json
{
  "ok": false,
  "error": "No se pudo obtener el episodio"
}
```

---

## 🛠️ TROUBLESHOOTING

| Problema | Solución |
|----------|----------|
| "No m3u8 found" | Verifica que la URL base sea correcta |
| "404" | El episodio no existe en ese servidor |
| "Timeout" | Intenta con otro servidor o idioma |
| Cache no funciona | Configura KV en Cloudflare |

---

**¡Listo para usar! 🚀**
