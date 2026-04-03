import {
  getAnimeFLVServers,
  getJKAnimeServers,
  getTioAnimeServers
} from "./sources";

import { filterWorkingServers } from "./filter";
import { resolveSlugVariants } from "./slugResolver";

// ======================
function uniqueServers(list: any[]) {

  const seen = new Set();
  const result = [];

  for (const s of list) {

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

  // 🥇 HLS REAL
  if (url.includes(".m3u8")) return 1000;

  // 🥈 PRIORIDADES TUYAS
  if (url.includes("yourupload")) return 900;
  if (url.includes("maru")) return 850;
  if (url.includes("ok.ru")) return 800;

  // 🥉 fallback
  if (url.includes("filemoon")) return 700;
  if (url.includes("streamwish")) return 600;

  return 100;
}

// ======================
export async function getAllServers({ slug, number, title, lang }: any) {

 // 🔥 limpiar slug mal formado (NO rompe nada)
const cleanSlug = slug.replace(/-\d+$/, "");

// 🔥 usar slug limpio + original
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

    // 🥇 JKANIME
    const jk = await getJKAnimeServers(v, number);

    if (jk.length) {
      collected.push(...jk);

      // si hay HLS → gana
      if (jk.some(s => s.embed.includes(".m3u8"))) break;
    }

    // 🥈 ANIMEFLV
    const flv = await getAnimeFLVServers(v, number);

    if (flv.length) {
      collected.push(...flv);
    }

    // si ya hay suficientes → parar
    if (collected.length >= 6) break;
  }

  // 🥉 LATINO
  if (lang === "latino") {
    const tio = await getTioAnimeServers(title, number);
    collected.push(...tio);
  }

  if (!collected.length) return [];

  // =====================
  // 🔥 LIMPIEZA
  // =====================
  const filtered = await filterWorkingServers(collected);
  const unique = uniqueServers(filtered);

  // =====================
  // 🔥 ORDEN FINAL
  // =====================
  const sorted = unique.sort((a, b) => scoreServer(b) - scoreServer(a));

  // =====================
  // 🔥 ASEGURAR MINIMO 3
  // =====================
  if (sorted.length < 3) return sorted;

  return sorted.slice(0, 6);
}
