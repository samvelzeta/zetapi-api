// server/api/admin/override.post.ts

import { saveOverride } from "../../utils/saveOverrides";

export default defineEventHandler(async (event) => {

  const body = await readBody(event);

  const { slug, url } = body;

  if (!slug || !url) {
    throw createError({ statusCode: 400 });
  }

  await saveOverride(slug, url);

  return {
    success: true,
    message: "override guardado"
  };
});
