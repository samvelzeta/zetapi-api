import { getAllServers } from "../../../../utils/getServers";

export default defineEventHandler(
  async (event: any) => {
    setHeader(
      event,
      "Access-Control-Allow-Origin",
      "*",
    );

    setHeader(
      event,
      "Access-Control-Allow-Methods",
      "GET,OPTIONS",
    );

    setHeader(
      event,
      "Access-Control-Allow-Headers",
      "Content-Type",
    );

    if (
      event.method ===
      "OPTIONS"
    ) {
      return "";
    }

    const {
      slug,
      number,
    } =
      getRouterParams(event);

    const query =
      getQuery(event) as Record<
        string,
        any
      >;

    const episode =
      Number.parseInt(
        String(number),
        10,
      );

    if (
      !slug ||
      !Number.isFinite(
        episode,
      )
    ) {
      throw createError({
        statusCode: 400,
        message:
          "Slug o número de episodio inválido",
      });
    }

    const env =
      (event.context as any)
        .cloudflare?.env;

    const lang =
      typeof query.lang ===
      "string"
        ? query.lang
        : "sub";

    const anilistId =
      query.anilistId
        ? Number(
            query.anilistId,
          )
        : undefined;

    /*
     * Compatible con Lovable:
     *
     * si no manda title,
     * utilizamos slug.
     */
    const title =
      typeof query.title ===
        "string" &&
      query.title.trim()
        ? query.title.trim()
        : slug;

    /*
     * CACHE
     *
     * Conservamos la misma estructura
     * de clave que utilizaba tu API.
     */
    if (env?.ANIME_CACHE) {
      try {
        const key =
          `${slug}:${episode}:${lang}`;

        const raw =
          await env.ANIME_CACHE.get(
            key,
          );

        if (raw) {
          const cached =
            JSON.parse(raw);

          if (
            Array.isArray(
              cached?.servers,
            ) &&
            cached.servers.length
          ) {
            return {
              success: true,

              source: "kv",

              data: {
                slug,
                number: episode,
                servers:
                  cached.servers,
              },
            };
          }
        }
      } catch {}
    }

    /*
     * SCRAPER
     */
    const servers =
      await getAllServers({
        slug,
        number: episode,
        title,
        anilistId:
          Number.isFinite(
            anilistId,
          )
            ? anilistId
            : undefined,
        env,
      });

    console.log(
      "🔍 Servers encontrados:",
      servers.length,
    );

    /*
     * CACHEAR RESULTADO.
     */
    if (
      env?.ANIME_CACHE &&
      servers.length
    ) {
      try {
        const key =
          `${slug}:${episode}:${lang}`;

        await env.ANIME_CACHE.put(
          key,
          JSON.stringify({
            servers,
          }),
          {
            expirationTtl:
              60 * 60 * 24 * 7,
          },
        );
      } catch {}
    }

    return {
      success: true,

      source:
        servers.length
          ? "scraper"
          : "empty",

      data: {
        slug,
        number: episode,
        servers,
      },
    };
  },
);
