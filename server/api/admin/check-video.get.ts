import { getKVVideo } from "../../utils/kv";

export default defineEventHandler(async (event) => {

  const { slug, episode, lang } = getQuery(event);

  const data = await getKVVideo(
    slug,
    Number(episode),
    lang || "sub",
    event.context.cloudflare?.env
  );

  return {
    exists: !!data
  };
});
