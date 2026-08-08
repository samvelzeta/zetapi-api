export default defineEventHandler(async (event) => {
  const url = new URL(event.request.url);

  // Si se recibe una petición proxy (con parámetro 'url'), servimos el recurso real
  if (url.searchParams.has('url')) {
    const targetUrl = url.searchParams.get('url')!;
    console.log('🔄 Proxy resource:', targetUrl);

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://animeav1.com/',
      },
    });

    // Cabeceras que facilitan la carga en un iframe
    const headers = new Headers(res.headers);
    headers.delete('x-frame-options');
    headers.delete('content-security-policy');
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(res.body, { status: res.status, headers });
  }

  // Petición inicial: obtenemos el HTML de Zilla y reescribimos todas las URLs
  const targetUrl = url.searchParams.get('url')!;
  if (!targetUrl) throw createError({ statusCode: 400, message: 'url required' });

  console.log('🌐 Proxy Zilla page:', targetUrl);

  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://animeav1.com/',
    },
  });

  let html = await res.text();

  // Patrones de atributos que contienen URLs y queremos redirigir por el proxy
  const patterns = [
    { tag: 'script', attr: 'src' },
    { tag: 'link',   attr: 'href' },
    { tag: 'img',    attr: 'src' },
    { tag: 'source', attr: 'src' },
    { tag: 'iframe', attr: 'src' },
  ];

  for (const { tag, attr } of patterns) {
    const regex = new RegExp(`<${tag}\\b[^>]*${attr}=["']([^"']+)["'][^>]*>`, 'gi');
    html = html.replace(regex, (fullMatch, urlValue) => {
      // No reescribir URLs que ya apuntan al proxy
      if (urlValue.startsWith('/proxy-zilla?url=')) return fullMatch;
      try {
        const absolute = new URL(urlValue, targetUrl).href;
        return fullMatch.replace(urlValue, `/proxy-zilla?url=${encodeURIComponent(absolute)}`);
      } catch {
        return fullMatch;
      }
    });
  }

  // También reescribir URLs en atributos style (background-image, etc.) – opcional pero útil
  html = html.replace(/url\(["']?([^"')]+)["']?\)/g, (full, urlValue) => {
    if (urlValue.startsWith('data:')) return full;
    try {
      const absolute = new URL(urlValue, targetUrl).href;
      return full.replace(urlValue, `/proxy-zilla?url=${encodeURIComponent(absolute)}`);
    } catch {
      return full;
    }
  });

  const headers = new Headers(res.headers);
  headers.delete('x-frame-options');
  headers.delete('content-security-policy');
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(html, { status: res.status, headers });
});
