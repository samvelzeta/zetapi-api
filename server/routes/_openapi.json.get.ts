export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);

  // --- CONFIGURACIÓN DE CORS PARA LA DOCS ---
  setResponseHeaders(event, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  });

  if (getMethod(event) === 'OPTIONS') {
    event.node.res.statusCode = 204;
    return 'ok';
  }

  // Obtenemos el esquema base generado por Nuxt Hub
  const hubOpenAPI = await $fetch("/api/_hub/openapi.json").catch(() => null);
  if (!hubOpenAPI) {
    throw createError({ 
      statusCode: 500, 
      message: "No se pudo cargar el esquema de OpenAPI" 
    });
  }

  const filteredPaths: Record<string, Record<string, any>> = {};

  // 1. FILTRADO: Solo incluimos rutas que tengan una descripción válida
  // Esto evita que rutas internas o vacías ensucien tu documentación.
  for (const [path, methods] of Object.entries(hubOpenAPI.paths as Record<string, Record<string, any>>)) {
    let keep = false;
    for (const method in methods) {
      if (
        methods[method] &&
        typeof methods[method].description === "string" &&
        methods[method].description.trim() !== ""
      ) {
        keep = true;
        break;
      }
    }
    if (keep) filteredPaths[path] = methods;
  }

  // 2. CONFIGURACIÓN DE INFO: Usamos lo que definiste en nuxt.config
  hubOpenAPI.info = config.openapi?.info || { title: "ZetAnime API", version: "1.0.0" };
  delete hubOpenAPI.servers; // Limpiamos servidores para que use la URL actual
  hubOpenAPI.paths = filteredPaths;

  // 3. ORDENAMIENTO LÓGICO: Organiza las rutas por categorías (Anime, Search, List)
  const sortedPaths = Object.entries(hubOpenAPI.paths).sort((a, b) => {
    const aPath = a[0].split("/").slice(2).join("/");
    const bPath = b[0].split("/").slice(2).join("/");
    
    const aSegments = aPath.split("/");
    const bSegments = bPath.split("/");
    
    const aFirstSegment = aSegments[0];
    const bFirstSegment = bSegments[0];

    // Si pertenecen a la misma categoría (ej. /search), ordena por longitud de ruta
    if (aFirstSegment === bFirstSegment) {
      return aSegments.length - bSegments.length;
    }
    
    // Si son categorías distintas, ordena alfabéticamente
    return aFirstSegment.localeCompare(bFirstSegment);
  });

  hubOpenAPI.paths = Object.fromEntries(sortedPaths);

  return hubOpenAPI;
});
//fix
