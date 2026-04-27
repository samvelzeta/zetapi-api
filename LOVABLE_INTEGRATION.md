# 🚀 GUÍA INTEGRACIÓN LOVABLE + SEEKE SCRAPER

## 📋 RESUMEN DE CAMBIOS

Se han integrado **2 nuevos archivos** + **2 actualizaciones** a tu API:

```
✅ NUEVO: server/utils/seekeScraper.ts
✅ NUEVO: server/api/anime/episode-seeke.get.ts  
✅ ACTUALIZADO: server/api/anime/[slug]/episode/[number].get.ts
✅ ACTUALIZADO: server/routes/_openapi.json.get.ts
```

---

## 🎯 ENDPOINTS DISPONIBLES

### 1️⃣ **NUEVO ENDPOINT (RECOMENDADO)**
```
GET /api/anime/episode-seeke?url=BASE_URL&ep=NUM
```

**Parámetros:**
- `url` (requerido): URL base del anime sin episodio
  - Ejemplo: `https://example.com/anime/naruto`
- `ep` (requerido): Número del episodio
  - Ejemplo: `5`
- `slug` (opcional): Para fallback a método viejo

**Response (éxito):**
```json
{
  "ok": true,
  "episode": 5,
  "embed": "https://cdn.example.com/videos/naruto-ep5.m3u8",
  "source": "seeke",
  "url": "https://example.com/anime/naruto",
  "cached": false
}
```

**Response (error):**
```json
{
  "ok": false,
  "error": "No se pudo obtener el episodio"
}
```

---

### 2️⃣ **ENDPOINT VIEJO (COMPATIBILIDAD)**
```
GET /api/anime/[slug]/episode/[number]?lang=sub&url=BASE_URL
```

**Ahora tiene:**
- ✅ Intenta SEEKE primero (si `url` está presente)
- ✅ Fallback a método legacy (getAllServers)
- ✅ Cache KV mejorado

---

## 💻 CÓMO USARLO DESDE LOVABLE

### **OPCIÓN A: Usando el endpoint nuevo (RECOMENDADO)**

```javascript
// En tu componente Vue/React de Lovable

async function playEpisode(animeId, episodeNumber, language = 'sub') {
  try {
    // 1. Construir URL base según idioma
    const baseUrl = `https://example.com/anime/${animeId}/${language}`;
    
    // 2. Llamar API
    const response = await fetch(
      `/api/anime/episode-seeke?url=${encodeURIComponent(baseUrl)}&ep=${episodeNumber}`
    );
    
    const data = await response.json();
    
    if (data.ok && data.embed) {
      // 3. Reproducir con tu player
      initPlayer(data.embed);
      console.log(`✅ Reproduciendo desde: ${data.source}`);
    } else {
      console.error('Error:', data.error);
    }
  } catch (error) {
    console.error('Error fetching episode:', error);
  }
}

// Uso:
playEpisode('naruto', 5, 'sub');    // → Subtitulado
playEpisode('bleach', 3, 'latino');  // → Doblado
```

---

### **OPCIÓN B: Usando el endpoint viejo mejorado**

```javascript
async function playEpisodeOld(slug, episodeNumber, language = 'sub', baseUrl = null) {
  try {
    let url = `/api/anime/${slug}/episode/${episodeNumber}?lang=${language}`;
    
    // Si tenemos URL base, intenta SEEKE primero
    if (baseUrl) {
      url += `&url=${encodeURIComponent(baseUrl)}`;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success && data.data.servers.length > 0) {
      const m3u8 = data.data.servers[0].embed;
      initPlayer(m3u8);
      console.log(`✅ Fuente: ${data.source}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Uso:
playEpisodeOld('naruto', 5, 'sub', 'https://example.com/anime/naruto/sub');
```

---

## 🎬 EJEMPLO COMPLETO - INTERFAZ LOVABLE

```vue
<template>
  <div class="anime-player">
    <!-- 🎭 SELECTOR DE IDIOMA -->
    <div class="language-buttons">
      <button @click="language = 'sub';" :class="{ active: language === 'sub' }">
        🗣️ Subtitulado
      </button>
      <button @click="language = 'latino'" :class="{ active: language === 'latino' }">
        🎤 Doblado
      </button>
    </div>

    <!-- 📺 LISTA DE EPISODIOS -->
    <div class="episodes-list">
      <button 
        v-for="ep in 24" 
        :key="ep"
        @click="playEpisode(ep)"
        :disabled="loading"
      >
        EP {{ ep }}
      </button>
    </div>

    <!-- 🎥 PLAYER -->
    <div v-if="currentUrl" class="player-container">
      <video ref="videoPlayer" controls></video>
      <p class="source-info">Fuente: {{ source }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const language = ref('sub');
const loading = ref(false);
const currentUrl = ref('');
const source = ref('');
const videoPlayer = ref(null);

async function playEpisode(episodeNumber) {
  loading.value = true;
  
  try {
    // 🔥 URL BASE (ADAPTAR SEGÚN TU SERVIDOR)
    const baseUrl = `https://example.com/anime/naruto/${language.value}`;
    
    const response = await fetch(
      `/api/anime/episode-seeke?url=${encodeURIComponent(baseUrl)}&ep=${episodeNumber}`
    );
    
    const data = await response.json();
    
    if (data.ok && data.embed) {
      currentUrl.value = data.embed;
      source.value = data.source;
      
      // Cargar en el video player
      if (videoPlayer.value) {
        videoPlayer.value.src = data.embed;
        videoPlayer.value.play();
      }
      
      console.log(`✅ EP ${episodeNumber} - ${language.value} - ${source.value}`);
    } else {
      console.error('Error:', data.error);
      alert('No se pudo obtener el episodio');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error al cargar el episodio');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.anime-player {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}

.language-buttons, .episodes-list {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

button {
  padding: 8px 16px;
  cursor: pointer;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button.active {
  background: #ff6b6b;
  color: white;
}

.player-container {
  width: 100%;
  max-width: 800px;
}

video {
  width: 100%;
  height: auto;
}

.source-info {
  font-size: 12px;
  color: #666;
}
</style>
```

---

## 🔧 CARACTERÍSTICAS PRINCIPALES

| Característica | Antes | Ahora |
|---|---|---|
| **Entrada** | slug + episodio | URL base + episodio |
| **Scraper** | AV1 + JK complejo | Seeke directo |
| **M3U8** | Con watermark | ✨ Limpio |
| **Compatibilidad** | Solo method viejo | Ambos métodos |
| **Fallback** | Ninguno | ✅ Automático |
| **Cache** | KV legacy | ✅ Ambos |

---

## 📊 CÓMO FUNCIONA INTERNAMENTE

```
LOVABLE (Frontend)
    ↓
/api/anime/episode-seeke?url=...&ep=5
    ↓
seekeScraper.ts (NEW)
    ├─ Construir URL: base/ep
    ├─ Hacer request
    ├─ Extraer m3u8 del HTML
    ├─ Validar que sea accesible
    └─ Retornar m3u8
    ↓
KV CACHE (30 días)
    ↓
JSON Response
    ↓
LOVABLE Player (HLS.js)
    ↓
🎬 Reproducir
```

---

## 🎯 VARIABLES DE URL BASE SEGÚN SERVIDOR

```javascript
// SEEKE CLONES (ejemplos)
const urls = {
  naruto_sub: 'https://123flmsfree.com/anime/naruto/sub',
  naruto_latino: 'https://123flmsfree.com/anime/naruto/latino',
  bleach_sub: 'https://peliculaplay.com/series/bleach/sub',
  onepiece_sub: 'https://example.com/anime/one-piece/sub'
};

// USO EN LOVABLE
playEpisode(urls.naruto_sub, 5); // Naruto EP 5 Subtitulado
```

---

## ⚠️ COSAS IMPORTANTES

✅ **Ya configurado:**
- Headers anti-bloqueo
- Rotación de User-Agent
- Validación de m3u8
- Cache KV automático
- Fallback a método viejo

⚠️ **Debes hacer:**
1. Reemplazar `BASE_URL` por URLs reales de tu servidor Seeke/clones
2. Configurar variables de entorno en Cloudflare Workers si es necesario
3. Probar con URLs reales

---

## 🚀 PRÓXIMOS PASOS

1. **Deploy a producción:**
   ```bash
   npm run build
   wrangler deploy
   ```

2. **Prueba el endpoint:**
   ```bash
   curl "http://localhost:3000/api/anime/episode-seeke?url=https://example.com/anime/naruto&ep=5"
   ```

3. **Integra en Lovable:**
   - Copia el código del ejemplo completo
   - Adapta las URLs base
   - Prueba en el navegador

---

## 📞 DEBUGGING

**Ver logs en Cloudflare:**
```bash
wrangler tail
```

**Respuestas esperadas:**
```
✅ SEEKE ÉXITO: https://cdn...m3u8
⚡ SERVIDO DESDE CACHE: seeke:xxxx:5
❌ SEEKE FALLÓ: No m3u8 found
⚠️ FALLBACK A SCRAPER LEGACY
```

---

**¡Listo! Tu API ahora soporta Seeke scraper + endpoint nuevo + Lovable 🎉**
