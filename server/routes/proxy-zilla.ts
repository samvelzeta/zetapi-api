// server/api/proxy-zilla.ts
export default defineEventHandler(async (event) => {
  // ─── Preflight ───
  if (event.method === 'OPTIONS') {
    setResponseHeaders(event, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Expose-Headers': '*',
      'Access-Control-Max-Age': '86400',
    })
    return new Response(null, { status: 204 })
  }

  const requestUrl = getRequestURL(event)
  const targetParam = requestUrl.searchParams.get('url')

  if (!targetParam) {
    throw createError({ statusCode: 400, statusMessage: 'Missing url parameter' })
  }

  let targetUrl: string
  try {
    targetUrl = decodeURIComponent(targetParam)
    new URL(targetUrl)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid URL' })
  }

  // ─── User Agents ───
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  ]
  const ua = userAgents[Math.floor(Math.random() * userAgents.length)]

  // Detectores más precisos
  const isM3U8 = /\.m3u8(\?|$)/i.test(targetUrl)
  const isTS = /\.ts(\?|$)/i.test(targetUrl)
  const isMP4 = /\.(mp4|m4v|webm|mkv)(\?|$)/i.test(targetUrl)
  const isHLS = isM3U8 || isTS
  const isVideo = isHLS || isMP4 || /\/(stream|hls|embed|player|media|getvideo|play)\//i.test(targetUrl)

  const isResource =
    requestUrl.searchParams.has('resource') ||
    isVideo ||
    /\.(js|css|png|jpe?g|webp|gif|svg|woff2?|ttf|json|xml|ico)(\?|$)/i.test(targetUrl)

  // Headers base
  const baseHeaders: Record<string, string> = {
    'User-Agent': ua,
    'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://animeav1.com/',
    'Origin': 'https://animeav1.com',
    'Sec-Fetch-Site': 'cross-site',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
  }

  // ────────────────────────────────────────────────
  // 1. RECURSOS (m3u8, ts, mp4, js, css...)
  // ────────────────────────────────────────────────
  if (isResource) {
    try {
      const range = getHeader(event, 'range')

      // Accept headers específicos según el tipo
      let accept = '*/*'
      if (isM3U8) {
        accept = 'application/vnd.apple.mpegurl,application/x-mpegURL,application/octet-stream,*/*;q=0.8'
      } else if (isTS) {
        accept = 'video/mp2t,video/*,application/octet-stream,*/*;q=0.8'
      } else if (isMP4) {
        accept = 'video/mp4,video/*,application/octet-stream,*/*;q=0.8'
      } else if (isVideo) {
        accept = 'video/*,application/octet-stream,*/*;q=0.8'
      }

      const headers: Record<string, string> = {
        ...baseHeaders,
        'Accept': accept,
        'Sec-Fetch-Dest': isVideo ? 'video' : 'script',
        'Sec-Fetch-Mode': 'no-cors',
      }

      // Range es crítico para MP4 (seeking)
      if (range) {
        headers['Range'] = range
      }

      const res = await fetch(targetUrl, {
        method: event.method === 'HEAD' ? 'HEAD' : 'GET',
        headers,
        redirect: 'follow',
      })

      const responseHeaders = new Headers()

      // Copiar headers importantes del upstream
      const importantHeaders = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'etag',
        'last-modified',
        'content-encoding',
      ]
      for (const h of importantHeaders) {
        const val = res.headers.get(h)
        if (val) responseHeaders.set(h, val)
      }

      // Forzar content-type correcto si el upstream miente
      if (isM3U8 && !responseHeaders.get('content-type')?.includes('mpegurl')) {
        responseHeaders.set('Content-Type', 'application/vnd.apple.mpegurl')
      }
      if (isTS && !responseHeaders.get('content-type')) {
        responseHeaders.set('Content-Type', 'video/mp2t')
      }
      if (isMP4 && !responseHeaders.get('content-type')?.includes('video')) {
        responseHeaders.set('Content-Type', 'video/mp4')
      }

      // CORS máximo
      responseHeaders.set('Access-Control-Allow-Origin', '*')
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
      responseHeaders.set('Access-Control-Allow-Headers', '*')
      responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, ETag, Content-Type')
      responseHeaders.set('Access-Control-Max-Age', '86400')

      responseHeaders.set('X-Content-Type-Options', 'nosniff')
      responseHeaders.set('Vary', 'User-Agent, Accept-Encoding')
      responseHeaders.set('Accept-Ranges', 'bytes')

      // Cache más largo en segmentos
      if (isTS || isMP4) {
        responseHeaders.set('Cache-Control', 'public, max-age=28800') // 8 horas
      } else if (isM3U8) {
        responseHeaders.set('Cache-Control', 'public, max-age=60') // manifests cortos
      } else {
        responseHeaders.set('Cache-Control', 'public, max-age=86400')
      }

      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
      })
    } catch (err) {
      console.error('[Proxy Resource Error]', targetUrl, err)
      throw createError({ statusCode: 502, statusMessage: 'Resource fetch failed' })
    }
  }

  // ────────────────────────────────────────────────
  // 2. PÁGINAS HTML + INYECCIÓN EXTREMA
  // ────────────────────────────────────────────────
  try {
    const res = await fetch(targetUrl, {
      headers: {
        ...baseHeaders,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
      },
      redirect: 'follow',
    })

    if (!res.ok) {
      throw createError({ statusCode: res.status, statusMessage: `Upstream ${res.status}` })
    }

    let html = await res.text()
    const base = new URL(targetUrl)

    const toProxy = (raw: string): string => {
      if (!raw || raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('javascript:') || raw.startsWith('#')) {
        return raw
      }
      if (raw.includes('/proxy-zilla')) return raw

      try {
        const absolute = new URL(raw, base).href
        const needsResource =
          /\.(m3u8|ts|mp4|webm|m4s|mpd|m4v|js|css|json)(\?|$)/i.test(absolute) ||
          /\/(stream|hls|embed|player|media|getvideo|play|ajax|api)\//i.test(absolute)

        return `/proxy-zilla?url=${encodeURIComponent(absolute)}${needsResource ? '&resource=1' : ''}`
      } catch {
        return raw
      }
    }

    // Reescritura profunda de atributos
    const tags = [
      { tag: 'script', attr: 'src' },
      { tag: 'link', attr: 'href' },
      { tag: 'img', attr: 'src' },
      { tag: 'source', attr: 'src' },
      { tag: 'iframe', attr: 'src' },
      { tag: 'video', attr: 'src' },
      { tag: 'audio', attr: 'src' },
      { tag: 'embed', attr: 'src' },
      { tag: 'object', attr: 'data' },
      { tag: 'track', attr: 'src' },
    ]

    for (const { tag, attr } of tags) {
      const regex = new RegExp(`<${tag}\\b([^>]*?)${attr}\\s*=\\s*["']([^"']+)["']([^>]*)>`, 'gi')
      html = html.replace(regex, (_, before, value, after) => {
        return `<${tag}${before}${attr}="${toProxy(value)}"${after}>`
      })
    }

    // srcset
    html = html.replace(/srcset\s*=\s*["']([^"']+)["']/gi, (_, srcset) => {
      const rewritten = srcset.split(',').map((part: string) => {
        const [u, ...rest] = part.trim().split(/\s+/)
        return `${toProxy(u)}${rest.length ? ' ' + rest.join(' ') : ''}`
      }).join(', ')
      return `srcset="${rewritten}"`
    })

    // data-* 
    html = html.replace(/(data-(?:src|lazy-src|original|bg|background|srcset|poster|file|url))\s*=\s*["']([^"']+)["']/gi, (_, attr, value) => {
      return `${attr}="${toProxy(value)}"`
    })

    // poster
    html = html.replace(/poster\s*=\s*["']([^"']+)["']/gi, (_, value) => `poster="${toProxy(value)}"`)

    // CSS url()
    html = html.replace(/url\((['"]?)([^"')]+)\1\)/gi, (full, quote, value) => {
      if (value.startsWith('data:')) return full
      return `url(${quote}${toProxy(value)}${quote})`
    })

    // Limpiar protecciones
    html = html
      .replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '')
      .replace(/<meta[^>]+content=["'][^"']*X-Frame-Options[^"']*["'][^>]*>/gi, '')
      .replace(/\s+sandbox=["'][^"']*["']/gi, '')

    // Iframes más permisivos
    html = html.replace(/<iframe\b([^>]*)>/gi, (_, attrs) => {
      let newAttrs = attrs
        .replace(/\s*sandbox=["'][^"']*["']/i, '')
        .replace(/\s*allow=["'][^"']*["']/i, '')
      newAttrs += ` allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowfullscreen`
      return `<iframe${newAttrs}>`
    })

    // 🔥 INYECCIÓN EXTREMA (fetch + XHR + HLS.js + setAttribute + MutationObserver)
    const injectScript = `
<script>
(function() {
  const PROXY = '/proxy-zilla?url=';

  function shouldProxy(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) return false;
    if (url.includes('/proxy-zilla')) return false;

    try {
      const u = new URL(url, location.href);
      return (
        u.origin !== location.origin ||
        /\\.(m3u8|ts|mp4|webm|m4s|mpd|m4v|json)(\\?|$)/i.test(u.pathname) ||
        /\\/(stream|hls|embed|player|media|getvideo|play|ajax|api|file)\\//i.test(u.pathname)
      );
    } catch (e) {
      return true;
    }
  }

  function toProxy(url) {
    try {
      const absolute = new URL(url, location.href).href;
      return PROXY + encodeURIComponent(absolute) + '&resource=1';
    } catch (e) {
      return url;
    }
  }

  // 1. Patch fetch
  const _fetch = window.fetch;
  window.fetch = function(input, init) {
    try {
      let url = typeof input === 'string' ? input : (input && input.url);
      if (shouldProxy(url)) {
        const proxied = toProxy(url);
        if (typeof input === 'string') input = proxied;
        else if (input instanceof Request) input = new Request(proxied, input);
      }
    } catch (e) {}
    return _fetch.call(this, input, init);
  };

  // 2. Patch XMLHttpRequest
  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    try {
      if (shouldProxy(url)) url = toProxy(url);
    } catch (e) {}
    return _open.call(this, method, url, ...rest);
  };

  // 3. Patch setAttribute
  const _setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    try {
      if ((name === 'src' || name === 'href') && shouldProxy(value)) {
        value = toProxy(value);
      }
    } catch (e) {}
    return _setAttribute.call(this, name, value);
  };

  // 4. Patch HLS.js si existe (muy importante)
  const patchHls = () => {
    try {
      if (window.Hls && window.Hls.prototype) {
        const originalLoadSource = window.Hls.prototype.loadSource;
        window.Hls.prototype.loadSource = function(src) {
          if (shouldProxy(src)) src = toProxy(src);
          return originalLoadSource.call(this, src);
        };
      }
    } catch (e) {}
  };
  patchHls();
  // Reintentar por si HLS.js se carga después
  setTimeout(patchHls, 1000);
  setTimeout(patchHls, 3000);

  // 5. MutationObserver para cambios dinámicos
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && (m.attributeName === 'src' || m.attributeName === 'href')) {
        const el = m.target;
        const val = el.getAttribute(m.attributeName);
        if (val && shouldProxy(val)) {
          el.setAttribute(m.attributeName, toProxy(val));
        }
      }
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    subtree: true,
    attributeFilter: ['src', 'href']
  });
})();
</script>
`

    // Inyectar lo más arriba posible
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${injectScript}`)
    } else if (html.includes('<html')) {
      html = html.replace(/<html[^>]*>/i, (m) => `${m}<head>${injectScript}</head>`)
    } else {
      html = injectScript + html
    }

    // Cabeceras finales
    const headers = new Headers()
    headers.set('Content-Type', res.headers.get('content-type') || 'text/html; charset=utf-8')
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    headers.set('Access-Control-Allow-Headers', '*')
    headers.set('Access-Control-Expose-Headers', '*')
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Vary', 'User-Agent')
    headers.set('Cache-Control', 'public, max-age=1800')
    headers.set('X-Frame-Options', 'ALLOWALL')
    headers.set('Content-Security-Policy', "frame-ancestors *;")

    return new Response(html, {
      status: res.status,
      headers,
    })
  } catch (err: any) {
    console.error('[Proxy Page Error]', targetUrl, err)
    throw createError({
      statusCode: 502,
      statusMessage: 'Proxy failed',
      data: { target: targetUrl, message: err?.message },
    })
  }
})
