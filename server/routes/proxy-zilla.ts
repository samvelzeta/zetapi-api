export default defineEventHandler(async (event) => {
  // ─── Preflight CORS ───
  if (event.method === 'OPTIONS') {
    setResponseHeaders(event, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Accept, Origin, Referer, User-Agent, X-Requested-With',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    })
    return new Response(null, { status: 204 })
  }

  const requestUrl = getRequestURL(event)
  const targetParam = requestUrl.searchParams.get('url')

  if (!targetParam) {
    throw createError({ statusCode: 400, statusMessage: 'Missing "url" parameter' })
  }

  let targetUrl: string
  try {
    targetUrl = decodeURIComponent(targetParam)
    new URL(targetUrl)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid URL' })
  }

  // ─── User-Agents realistas ───
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  ]
  const ua = userAgents[Math.floor(Math.random() * userAgents.length)]
  const isChrome = ua.includes('Chrome') && !ua.includes('Edg')

  // ─── Detectores ───
  const isVideoLike =
    /\.(m3u8|ts|mp4|webm|mkv|m4s|mpd|m4v)(\?|$)/i.test(targetUrl) ||
    /\/(stream|hls|video|embed|player|media|play|file|getvideo)\//i.test(targetUrl) ||
    /(?:streamwish|filemoon|voe|dood|mp4upload|yourupload|mixdrop|upstream|streamtape|vidhide|luluvdo|turbo|vidsrc)/i.test(targetUrl)

  const isResource =
    requestUrl.searchParams.has('resource') ||
    isVideoLike ||
    /\.(js|css|png|jpe?g|webp|gif|svg|woff2?|ttf|ico|json|xml)(\?|$)/i.test(targetUrl)

  // ─── Headers base ───
  const baseHeaders: Record<string, string> = {
    'User-Agent': ua,
    'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Referer': 'https://animeav1.com/',
    'Origin': 'https://animeav1.com',
    'Sec-Fetch-Site': 'cross-site',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  }

  if (isChrome) {
    baseHeaders['Sec-Ch-Ua'] = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"'
    baseHeaders['Sec-Ch-Ua-Mobile'] = '?0'
    baseHeaders['Sec-Ch-Ua-Platform'] = '"Windows"'
  }

  // ────────────────────────────────────────────────
  // 1. PROXY DE RECURSOS
  // ────────────────────────────────────────────────
  if (isResource) {
    try {
      const range = getHeader(event, 'range')

      const fetchHeaders: Record<string, string> = {
        ...baseHeaders,
        'Accept': isVideoLike
          ? 'application/vnd.apple.mpegurl,application/x-mpegURL,video/*,application/octet-stream,*/*;q=0.8'
          : '*/*',
        'Sec-Fetch-Dest': isVideoLike ? 'video' : 'script',
        'Sec-Fetch-Mode': 'no-cors',
      }

      if (range) fetchHeaders['Range'] = range

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: fetchHeaders,
        redirect: 'follow',
      })

      const headers = new Headers()

      // Pasar headers útiles
      for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
        const val = res.headers.get(h)
        if (val) headers.set(h, val)
      }

      // Cabeceras recomendadas + anti-bloqueo
      headers.set('Access-Control-Allow-Origin', '*')
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
      headers.set('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Origin, Referer')
      headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, ETag')
      headers.set('Access-Control-Max-Age', '86400')
      headers.set('X-Content-Type-Options', 'nosniff')
      headers.set('Vary', 'User-Agent')
      headers.set('Keep-Alive', 'timeout=5, max=100')
      headers.set('Cache-Control', isVideoLike ? 'public, max-age=14400' : 'public, max-age=86400')

      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      })
    } catch (err) {
      console.error('[Proxy Resource Error]', targetUrl, err)
      throw createError({ statusCode: 502, statusMessage: 'Resource fetch failed' })
    }
  }

  // ────────────────────────────────────────────────
  // 2. PROXY DE PÁGINAS HTML + INYECCIÓN DE FETCH
  // ────────────────────────────────────────────────
  try {
    const res = await fetch(targetUrl, {
      headers: {
        ...baseHeaders,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
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

    // Función para convertir a proxy
    const toProxy = (raw: string): string => {
      if (!raw || raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('javascript:') || raw.startsWith('#')) {
        return raw
      }
      if (raw.includes('/proxy-zilla')) return raw

      try {
        const absolute = new URL(raw, base).href
        const isVid =
          /\.(m3u8|ts|mp4|webm|m4s|mpd)(\?|$)/i.test(absolute) ||
          /\/(embed|stream|hls|player|media|getvideo)\//i.test(absolute) ||
          /(?:streamwish|filemoon|voe|dood|mp4upload|mixdrop|yourupload|vidsrc)/i.test(absolute)

        return `/proxy-zilla?url=${encodeURIComponent(absolute)}${isVid ? '&resource=1' : ''}`
      } catch {
        return raw
      }
    }

    // Reescritura de atributos
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
    html = html.replace(/(data-(?:src|lazy-src|original|bg|background|srcset|poster))\s*=\s*["']([^"']+)["']/gi, (_, attr, value) => {
      return `${attr}="${toProxy(value)}"`
    })

    // poster
    html = html.replace(/poster\s*=\s*["']([^"']+)["']/gi, (_, value) => `poster="${toProxy(value)}"`)

    // CSS url()
    html = html.replace(/url\((['"]?)([^"')]+)\1\)/gi, (full, quote, value) => {
      if (value.startsWith('data:')) return full
      return `url(${quote}${toProxy(value)}${quote})`
    })

    // style attributes
    html = html.replace(/style\s*=\s*["']([^"']*)["']/gi, (_, content) => {
      const newContent = content.replace(/url\((['"]?)([^"')]+)\1\)/gi, (f: string, q: string, v: string) => {
        if (v.startsWith('data:')) return f
        return `url(${q}${toProxy(v)}${q})`
      })
      return `style="${newContent}"`
    })

    // Limpiar protecciones
    html = html
      .replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '')
      .replace(/<meta[^>]+content=["'][^"']*X-Frame-Options[^"']*["'][^>]*>/gi, '')
      .replace(/\s+sandbox=["'][^"']*["']/gi, '')

    // Hacer iframes más permisivos
    html = html.replace(/<iframe\b([^>]*)>/gi, (_, attrs) => {
      let newAttrs = attrs
        .replace(/\s*sandbox=["'][^"']*["']/i, '')
        .replace(/\s*allow=["'][^"']*["']/i, '')
      newAttrs += ` allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowfullscreen`
      return `<iframe${newAttrs}>`
    })

    // 🔥 INYECCIÓN DE FETCH + XHR (lo más importante)
    const injectScript = `
<script>
(function() {
  const PROXY = '/proxy-zilla?url=';
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  function shouldProxy(url) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) return false;
    if (url.includes('/proxy-zilla')) return false;
    // Proxyear casi todo lo que no sea same-origin estricto
    try {
      const u = new URL(url, location.href);
      return u.origin !== location.origin || 
             /\\.(m3u8|ts|mp4|webm|m4s|mpd|json)(\\?|$)/i.test(u.pathname) ||
             /\\/(stream|hls|embed|player|media|getvideo|ajax)\\//i.test(u.pathname);
    } catch {
      return true;
    }
  }

  function toProxyUrl(url) {
    try {
      const absolute = new URL(url, location.href).href;
      return PROXY + encodeURIComponent(absolute) + '&resource=1';
    } catch {
      return url;
    }
  }

  // Patch fetch
  window.fetch = function(input, init) {
    let url = typeof input === 'string' ? input : input.url;
    if (shouldProxy(url)) {
      url = toProxyUrl(url);
      if (typeof input === 'string') {
        input = url;
      } else {
        input = new Request(url, input);
      }
    }
    return originalFetch.call(this, input, init);
  };

  // Patch XMLHttpRequest
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (shouldProxy(url)) {
      url = toProxyUrl(url);
    }
    return originalXHROpen.call(this, method, url, ...rest);
  };
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
    headers.set('Keep-Alive', 'timeout=5, max=100')
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
      statusMessage: 'Proxy page failed',
      data: { target: targetUrl, message: err?.message },
    })
  }
})
