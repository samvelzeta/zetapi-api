import { saveCache } from "../../utils/cache";
import { fetchHtml } from "../../utils/fetcher";
import { resolveServer } from "../../utils/resolver";

// ======================
function extractUrls(html: string) {

  const urls = new Set<string>();

  const m3u8 = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
  m3u8?.forEach(u => urls.add(u));

  const mp4 = html.match(/https?:\/\/[^"' ]+\.mp4[^"' ]*/g);
  mp4?.forEach(u => urls.add(u));

  const iframes = [
    ...html.matchAll(/<iframe[^>]+src="([^"]+)"/g)
  ].map(m => m[1]);

  iframes.forEach(u => urls.add(u));

  return Array.from(urls);
}

// ======================
export default defineEventHandler(async (event) => {

  const body = await readBody(event);

  const { slug, number, url } = body;

  if (!slug || !number || !url) {
    return { error: "faltan datos" };
  }

  const html = await fetchHtml(url);

  if (!html) {
    return { error: "no se pudo cargar la pagina" };
  }

  const raw = extractUrls(html);

  const resolved = await Promise.allSettled(
    raw.map(u => resolveServer(u))
  );

  const servers = resolved
    .filter(r => r.status === "fulfilled" && r.value)
    .map((r: any) => ({
      embed: r.value
    }));

  if (!servers.length) {
    return { error: "no se encontraron servers" };
  }

  await saveCache(slug, Number(number), "sub", servers);

  return {
    success: true,
    total: servers.length
  };
});
