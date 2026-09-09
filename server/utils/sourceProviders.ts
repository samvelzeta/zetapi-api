/**
 * SOURCE PROVIDERS - Interfaz unificada para todas las fuentes de anime
 * 
 * Define la estructura común que todos los scrapers deben seguir
 * para facilitar integración, testeo y mantenimiento
 */

export interface AnimeProvider {
  name: string;
  baseUrl: string;
  isActive: boolean;
}

export interface SearchResult {
  slug: string;
  title: string;
  url: string;
  malId?: number;
  anilistId?: number;
}

export interface EpisodeServer {
  name: string;
  url: string;
  quality?: string;
  type: "direct" | "embedded" | "m3u8";
}

export interface EpisodeData {
  number: number;
  title?: string;
  servers: EpisodeServer[];
  permalink?: string;
}

export interface AnimeMetadata {
  slug: string;
  title: string;
  titleEn?: string;
  titleJa?: string;
  synopsis?: string;
  coverImage?: string;
  bannerImage?: string;
  malId?: number;
  anilistId?: number;
  year?: number;
  season?: string;
  status?: "airing" | "completed" | "upcoming";
  episodes?: number;
  genres?: string[];
  studios?: string[];
  source: string;
}

/**
 * Interfaz base para todos los scrapers
 */
export interface IAnimeSource {
  provider: AnimeProvider;
  
  /**
   * Busca anime por título
   */
  search(query: string): Promise<SearchResult[]>;
  
  /**
   * Obtiene información completa del anime
   */
  getMetadata(slug: string): Promise<AnimeMetadata | null>;
  
  /**
   * Obtiene servidores para un episodio específico
   */
  getServers(slug: string, episodeNumber: number): Promise<EpisodeServer[]>;
  
  /**
   * Verifica si el proveedor está disponible
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Agregador que coordina múltiples fuentes
 */
export class AnimeSourceAggregator {
  private sources: Map<string, IAnimeSource> = new Map();

  registerSource(source: IAnimeSource): void {
    this.sources.set(source.provider.name, source);
  }

  getActiveSources(): IAnimeSource[] {
    return Array.from(this.sources.values()).filter(
      s => s.provider.isActive
    );
  }

  /**
   * Busca en todas las fuentes activas
   */
  async searchAll(query: string): Promise<Map<string, SearchResult[]>> {
    const results = new Map<string, SearchResult[]>();
    const sources = this.getActiveSources();

    const searches = await Promise.allSettled(
      sources.map(async source => ({
        name: source.provider.name,
        results: await source.search(query),
      }))
    );

    for (const result of searches) {
      if (result.status === "fulfilled") {
        results.set(result.value.name, result.value.results);
      }
    }

    return results;
  }

  /**
   * Obtiene servidores de todas las fuentes
   */
  async getServersFromAll(
    slug: string,
    episodeNumber: number,
    preferredSources?: string[]
  ): Promise<EpisodeServer[]> {
    const allServers: EpisodeServer[] = [];
    const seen = new Set<string>();
    
    const sources = preferredSources
      ? Array.from(this.sources.values()).filter(s =>
          preferredSources.includes(s.provider.name)
        )
      : this.getActiveSources();

    const serverSearches = await Promise.allSettled(
      sources.map(source =>
        source.getServers(slug, episodeNumber)
      )
    );

    for (const result of serverSearches) {
      if (result.status === "fulfilled") {
        for (const server of result.value) {
          const key = `${server.url}-${server.name}`.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            allServers.push(server);
          }
        }
      }
    }

    return allServers;
  }
}
