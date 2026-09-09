/**
 * CACHING STRATEGY - Estrategia de caché para Cloudflare Workers
 * 
 * Implementa caché de dos niveles:
 * - Memory Cache: rápido, para dentro de una request
 * - KV Store: persistente, compartido entre workers
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live en segundos
}

export interface CacheConfig {
  defaultTtl: number; // TTL por defecto
  maxMemoryEntries: number; // Máximo en memoria
  kvNamespace?: any; // Cloudflare KV binding
}

/**
 * Caché de dos niveles: memoria + KV
 */
export class HybridCache<T> {
  private memoryCache = new Map<string, CacheEntry<T>>();
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = {
      defaultTtl: config.defaultTtl || 3600, // 1 hora por defecto
      maxMemoryEntries: config.maxMemoryEntries || 1000,
      kvNamespace: config.kvNamespace,
    };
  }

  /**
   * Obtiene del caché (memoria primero, luego KV)
   */
  async get(key: string): Promise<T | null> {
    // 1. Intentar memoria
    const memEntry = this.memoryCache.get(key);
    if (memEntry && !this.isExpired(memEntry)) {
      return memEntry.data;
    }

    // 2. Intentar KV
    if (this.config.kvNamespace) {
      try {
        const kvData = await this.config.kvNamespace.get(key, "json");
        if (kvData) {
          const entry = kvData as CacheEntry<T>;
          if (!this.isExpired(entry)) {
            // Restaurar en memoria
            this.setMemory(key, entry);
            return entry.data;
          }
        }
      } catch (error) {
        console.warn(`KV get error for key ${key}:`, error);
      }
    }

    return null;
  }

  /**
   * Guarda en ambos cachés
   */
  async set(
    key: string,
    data: T,
    ttl?: number
  ): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTtl,
    };

    // Memoria
    this.setMemory(key, entry);

    // KV
    if (this.config.kvNamespace) {
      try {
        await this.config.kvNamespace.put(
          key,
          JSON.stringify(entry),
          {
            expirationTtl: entry.ttl,
          }
        );
      } catch (error) {
        console.warn(`KV set error for key ${key}:`, error);
      }
    }
  }

  /**
   * Guarda solo en memoria (para datos transitorios)
   */
  private setMemory(key: string, entry: CacheEntry<T>): void {
    // Limpiar si alcanzamos máximo
    if (this.memoryCache.size >= this.config.maxMemoryEntries) {
      const oldestKey = Array.from(this.memoryCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
      this.memoryCache.delete(oldestKey);
    }

    this.memoryCache.set(key, entry);
  }

  /**
   * Verifica si una entrada expiró
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    const age = (Date.now() - entry.timestamp) / 1000;
    return age > entry.ttl;
  }

  /**
   * Elimina del caché
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    
    if (this.config.kvNamespace) {
      try {
        await this.config.kvNamespace.delete(key);
      } catch (error) {
        console.warn(`KV delete error for key ${key}:`, error);
      }
    }
  }

  /**
   * Limpia todo el caché de memoria
   */
  clearMemory(): void {
    this.memoryCache.clear();
  }

  /**
   * Estadísticas del caché
   */
  getStats() {
    return {
      memorySize: this.memoryCache.size,
      maxMemory: this.config.maxMemoryEntries,
      defaultTtl: this.config.defaultTtl,
    };
  }
}

/**
 * Factory para crear cachés tipados
 */
export class CacheFactory {
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  /**
   * Crea caché para slugs
   */
  createSlugCache() {
    return new HybridCache<string>({
      ...this.config,
      defaultTtl: 7 * 24 * 3600, // 7 días
    });
  }

  /**
   * Crea caché para metadata
   */
  createMetadataCache() {
    return new HybridCache<Record<string, any>>({
      ...this.config,
      defaultTtl: 24 * 3600, // 1 día
    });
  }

  /**
   * Crea caché para servidores (corta duración)
   */
  createServersCache() {
    return new HybridCache<any[]>({
      ...this.config,
      defaultTtl: 6 * 3600, // 6 horas
    });
  }
}

/**
 * Helper: Crea clave de caché consistente
 */
export function cacheKey(...parts: string[]): string {
  return parts
    .map(p => String(p || "").toLowerCase().replace(/\s+/g, "-"))
    .join("::");
}

/**
 * Helper: Tipos comunes
 */
export const CACHE_TYPES = {
  SLUG: "slug",
  METADATA: "metadata",
  SERVERS: "servers",
  SEARCH: "search",
} as const;

/**
 * Helper: TTLs predefinidos
 */
export const DEFAULT_TTLS = {
  VERY_SHORT: 300, // 5 minutos
  SHORT: 3600, // 1 hora
  MEDIUM: 6 * 3600, // 6 horas
  LONG: 24 * 3600, // 1 día
  VERY_LONG: 7 * 24 * 3600, // 7 días
} as const;
