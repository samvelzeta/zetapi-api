import { saveKVVideo } from "../../utils/kv";

export default defineEventHandler(async (event) => {

  const body = await readBody(event);

  const { slug, episode, lang, sources } = body;

  if (!slug || !episode || !sources) {
    throw createError({ statusCode: 400 });
  }

  await saveKVVideo(
    slug,
    Number(episode),
    lang || "sub",
    {
      sources: {
        hls: sources.hls || [],
        mp4: sources.mp4 || [],
        embed: sources.embed || []
      }
    },
    event.context.cloudflare?.env
  );

  return {
    success: true
  };
});
