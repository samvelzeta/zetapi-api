import { getLatest } from "animeflv-scraper";

export default defineEventHandler(async (event) => {
  // 1. CONFIGURACIÓN DE CABECERAS (Basado en tu investigación de MDN)
  setResponseHeaders(event, {
    // Permitimos que Base44 acceda desde cualquier lado
    "Access-Control-Allow-Origin": "*", 
    // Permitimos los métodos que mencionaba el reporte
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    // Agregamos 'Accept' y 'Content-Type' para que la negociación sea exitosa
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
    "Access-Control-Max-Age": "86400" 
  });

  // 2. MANEJO DE PRE-CONSULTA (OPTIONS)
  // El navegador envía esto primero para ver si el servidor acepta el header 'Accept'
  if (getMethod(event) === 'OPTIONS') {
    event.node.res.statusCode = 204;
    return 'ok';
  }

  // 3. LÓGICA DE DATOS
  try {
    const latest = await getLatest();
    if (!latest) {
      throw createError({
        statusCode: 404,
        message: "No se encontraron episodios",
      });
    }

    return {
      success: true,
      data: latest
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: "Error en el servidor de Anime",
    });
  }
});

// Mantén tu bloque de defineRouteMeta debajo de esto...
