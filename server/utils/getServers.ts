import {
  getAnimeFLVServers,
  getJKAnimeServers
} from "./sources";

import { filterWorkingServers } from "./filter";
import { resolveSlugVariants } from "./slugResolver";

// ======================
function uniqueServers(list: any[]) {

  const seen = new Set();
  const result = [];

  for (const s of list) {

    if (!s?.embed) continue;

    const clean = s.embed.split("?")[0];

    if (!seen.has(clean)) {
      seen.add(clean);
      result.push(s);
    }
  }

  return result;
}

// ======================
function scoreServer(server: any) {

  const url = (server.embed || "").toLowerCase();

  // 🥇 HLS REAL (PRIORIDAD ABSOLUTA)
  if (url.includes(".m3u8")) return 1000;

  // 🥈 servidores buenos sin ads pesados
  if (url.includes("yourupload")) return 900;
  if (url.includes("maru")) return 850;
  if (url.includes("ok.ru")) return 800;

  // 🥉 fallback
  if (url.includes("filemoon")) return 700;
  if (url.includes("streamwish")) return 600;

  return 100;
}

// ======================
export async function getAllServers({ slug, number, title }: any) {

  // 🔥 limpiar slug mal formado (ej: -1)
  const cleanSlug = slug.replace(/-\d+$/, "");

  // 🔥 variantes inteligentes
  const variants = [
    ...(await resolveSlugVariants(cleanSlug)),
    ...(await resolveSlugVariants(slug)),
    ...(await resolveSlugVariants(title))
  ];

  let collected: any[] = [];

  // =====================
  // 🔥 BUSQUEDA INTENSA
  // =====================
  for (const v of variants) {

    // =====================
    // 🥇 JKANIME PRIMERO SIEMPRE
    // =====================
    const jk = await getJKAnimeServers(v, number);

    if (jk.length) {

      // 🔥 PRIORIDAD: intentar quedarnos con HLS real
      const hlsOnly = jk.filter(s =>
        s.embed && s.embed.includes(".m3u8")
      );

     if (hlsOnly.length) {
  collected.push(...hlsOnly);
  break;
}

      collected.push(...jk);
    }

    // =====================
    // 🥈 ANIMEFLV
    // =====================
    const flv = await getAnimeFLVServers(v, number);

    if (flv.length) {
      collected.push(...flv);
    }

    // 🔥 si ya hay suficientes → parar
    if (collected.length >= 6) break;
  }

  if (!collected.length) return [];

  // =====================
  // 🔥 FILTRO
  // =====================
  const filtered = await filterWorkingServers(collected);

  // =====================
  // 🔥 UNICOS
  // =====================
  const unique = uniqueServers(filtered);

  // =====================
  // 🔥 ORDEN
  // =====================
  const sorted = unique.sort((a, b) => scoreServer(b) - scoreServer(a));

  return sorted.slice(0, 6);
}
