/**
 * CLOUDFLARE ADAPTER - Adaptador para Cloudflare Workers
 * 
 * Convierte requestss HTTP en órdenes de scraping
 * Empaqueta respuestas optimizadas para Workers
 * Maneja errores y fallbacks automáticos
 */

import { HybridCache, CacheFactory, cacheKey } from "./cachingStrategy";
import { matchScore, findBestMatch } from "./titleMatcherV2";
import {
  AnimeSourceAggregator,
  IAnimeSource,
  EpisodeServer,
} from "./sourceProviders";

export interface CloudflareWorkerEnv {
  SLUG_CACHE?: any;
  ANIME_CACHE?: any;
  SERVERS_CACHE?: any;
}

export interface ScraperRequest {
  action: "search" | "servers" | "metadata";
  title?: string;
  slug?: string;
  episodeNumber?: number;
  malId?: number;
  anilistId?: number;
}

export interface ScraperResponse<T = any> {
  success: boolean;
  data: T | null;
  error: string | null;
  source: string | null;
  timestamp: number;
  cached: boolean;
  duration: number;
}

/**
 * Adaptador principal para Cloudflare Workers
 */
export class CloudflareScraperAdapter {
  private aggregator: AnimeSourceAggregator;
  private cacheFactory: CacheFactory;
  private slugCache: HybridCache<string>;
  private metadataCache: HybridCache<Record<string, any>>;
  private serversCache: HybridCache<EpisodeServer[]>;
  private env: CloudflareWorkerEnv;

  constructor(
    aggregator: AnimeSourceAggregator,
    env: CloudflareWorkerEnv
  ) {
    this.aggregator = aggregator;
    this.env = env;

    const cacheConfig = {
      defaultTtl: 3600,
      maxMemoryEntries: 500,
      kvNamespace: env.SLUG_CACHE,
    };

    this.cacheFactory = new CacheFactory(cacheConfig);
    this.slugCache = this.cacheFactory.createSlugCache();
    this.metadataCache = this.cacheFactory.createMetadataCache();
    this.serversCache = this.cacheFactory.createServersCache();
  }

  /**
   * Procesa una request de scraping
   */
  async handleRequest(
    request: ScraperRequest
  ): Promise<ScraperResponse> {
    const startTime = performance.now();

    try {
      switch (request.action) {
        case "search":
          return await this.handleSearch(request, startTime);

        case "servers":
          return await this.handleServers(request, startTime);

        case "metadata":
          return await this.handleMetadata(request, startTime);

        default:
          throw new Error(`Unknown action: ${request.action}`);
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      return {
        success: false,
        data: null,
        error: String(error),
        source: null,
        timestamp: Date.now(),
        cached: false,
        duration,
      };
    }
  }

  /**
   * Busca anime por título
   */
  private async handleSearch(
    request: ScraperRequest,
    startTime: number
  ): Promise<ScraperResponse> {
    if (!request.title) {
      throw new Error("Title is required for search");
    }

    const cacheKey_ = cacheKey("search", request.title);
    const cached = await this.metadataCache.get(cacheKey_);

    if (cached) {
      const duration = performance.now() - startTime;
      return {
        success: true,
        data: cached,
        error: null,
        source: "cache",
        timestamp: Date.now(),
        cached: true,
        duration,
      };
    }

    // Buscar en todas las fuentes
    const allResults = await this.aggregator.searchAll(request.title);
    
    // Consolidar y ordenar por relevancia
    const consolidated: Record<string, any>[] = [];
    const seen = new Set<string>();

    for (const [source, results] of allResults) {
      for (const result of results) {
        const key = `${result.slug}-${source}`;
        if (!seen.has(key)) {
          seen.add(key);
          consolidated.push({
            ...result,
            source,
            score: matchScore(
              result.title,
              result.slug,
              result.malId || null,
              [request.title],
              request.malId || null
            ),
          });
        }
      }
    }

    // Ordenar por score
    consolidated.sort((a, b) => b.score - a.score);

    // Guardar en caché
    await this.metadataCache.set(cacheKey_, consolidated);

    const duration = performance.now() - startTime;
    return {
      success: true,
      data: consolidated.slice(0, 10), // Top 10
      error: null,
      source: "aggregated",
      timestamp: Date.now(),
      cached: false,
      duration,
    };
  }

  /**
   * Obtiene servidores de un episodio
   */
  private async handleServers(
    request: ScraperRequest,
    startTime: number
  ): Promise<ScraperResponse> {
    if (!request.slug || !request.episodeNumber) {
      throw new Error("Slug and episodeNumber are required");
    }

    const cacheKey_ = cacheKey(
      "servers",
      request.slug,
      String(request.episodeNumber)
    );
    const cached = await this.serversCache.get(cacheKey_);

    if (cached) {
      const duration = performance.now() - startTime;
      return {
        success: true,
        data: this.packServers(cached),
        error: null,
        source: "cache",
        timestamp: Date.now(),
        cached: true,
        duration,
      };
    }

    // Obtener servidores de todas las fuentes
    const servers = await this.aggregator.getServersFromAll(
      request.slug,
      request.episodeNumber
    );

    if (servers.length > 0) {
      // Guardar en caché
      await this.serversCache.set(cacheKey_, servers);
    }

    const duration = performance.now() - startTime;
    return {
      success: servers.length > 0,
      data: this.packServers(servers),
      error: servers.length === 0 ? "No servers found" : null,
      source: "aggregated",
      timestamp: Date.now(),
      cached: false,
      duration,
    };
  }

  /**
   * Obtiene metadata del anime
   */
  private async handleMetadata(
    request: ScraperRequest,
    startTime: number
  ): Promise<ScraperResponse> {
    if (!request.slug) {
      throw new Error("Slug is required");
    }

    const cacheKey_ = cacheKey("metadata", request.slug);
    const cached = await this.metadataCache.get(cacheKey_);

    if (cached) {
      const duration = performance.now() - startTime;
      return {
        success: true,
        data: cached,
        error: null,
        source: "cache",
        timestamp: Date.now(),
        cached: true,
        duration,
      };
    }

    // Obtener de la primera fuente disponible
    const sources = this.aggregator.getActiveSources();
    for (const source of sources) {
      try {
        const metadata = await source.getMetadata(request.slug);
        if (metadata) {
          await this.metadataCache.set(cacheKey_, metadata);

          const duration = performance.now() - startTime;
          return {
            success: true,
            data: metadata,
            error: null,
            source: source.provider.name,
            timestamp: Date.now(),
            cached: false,
            duration,
          };
        }
      } catch (error) {
        console.warn(`Error getting metadata from ${source.provider.name}:`, error);
      }
    }

    const duration = performance.now() - startTime;
    return {
      success: false,
      data: null,
      error: "Metadata not found in any source",
      source: null,
      timestamp: Date.now(),
      cached: false,
      duration,
    };
  }

  /**
   * Empaqueta servidores para optimizar respuesta
   */
  private packServers(servers: EpisodeServer[]): Record<string, any> {
    const grouped = new Map<string, EpisodeServer[]>();

    for (const server of servers) {
      const provider = server.name || "Unknown";
      if (!grouped.has(provider)) {
        grouped.set(provider, []);
      }
      grouped.get(provider)!.push(server);
    }

    return Object.fromEntries(grouped);
  }

  /**
   * Obtiene estadísticas del adaptador
   */
  getStats() {
    return {
      slug_cache: this.slugCache.getStats(),
      metadata_cache: this.metadataCache.getStats(),
      servers_cache: this.serversCache.getStats(),
      active_sources: this.aggregator.getActiveSources().length,
      timestamp: Date.now(),
    };
  }

  /**
   * Limpia caché
   */
  async clearCache(type?: string): Promise<void> {
    if (!type || type === "slug") this.slugCache.clearMemory();
    if (!type || type === "metadata") this.metadataCache.clearMemory();
    if (!type || type === "servers") this.serversCache.clearMemory();
  }
}

/**
 * Factory para crear el adaptador
 */
export function createCloudflareAdapter(
  aggregator: AnimeSourceAggregator,
  env: CloudflareWorkerEnv
): CloudflareScraperAdapter {
  return new CloudflareScraperAdapter(aggregator, env);
}

/**
 * Helper: Convierte respuesta a JSON para Cloudflare
 */
export function toCloudflareResponse<T>(
  scraperResponse: ScraperResponse<T>
): Response {
  return new Response(JSON.stringify(scraperResponse), {
    status: scraperResponse.success ? 200 : 400,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": scraperResponse.cached
        ? "public, max-age=3600"
        : "no-cache",
      "X-Cached": String(scraperResponse.cached),
      "X-Duration-Ms": String(scraperResponse.duration.toFixed(2)),
    },
  });
}
