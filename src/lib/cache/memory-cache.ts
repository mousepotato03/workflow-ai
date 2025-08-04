/**
 * In-memory caching system for API responses
 * Implements LRU (Least Recently Used) eviction policy
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  lastAccessed: number;
  hitCount: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  hitRate: number;
}

class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTTL: number; // Time to live in milliseconds
  private stats = { hits: 0, misses: 0 };

  constructor(maxSize: number = 100, defaultTTL: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.lastAccessed = Date.now();
    entry.hitCount++;
    this.stats.hits++;

    return entry.data;
  }

  /**
   * Set value in cache
   */
  set(key: string, data: T, ttl?: number): void {
    const now = Date.now();

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      lastAccessed: now,
      hitCount: 0,
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() - entry.timestamp > this.defaultTTL) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      entries: this.cache.size,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Generate cache key from object
   */
  static generateKey(obj: any): string {
    if (typeof obj === "string") return obj;

    try {
      return JSON.stringify(obj, Object.keys(obj).sort());
    } catch {
      return String(obj);
    }
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.defaultTTL) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

// Create cache instances for different types of data
export const workflowCache = new MemoryCache<any>(50, 10 * 60 * 1000); // 10 minutes TTL
export const toolSearchCache = new MemoryCache<any>(100, 15 * 60 * 1000); // 15 minutes TTL
export const taskDecompositionCache = new MemoryCache<any>(30, 20 * 60 * 1000); // 20 minutes TTL

// Cache utilities
export const CacheUtils = {
  generateKey: MemoryCache.generateKey,

  /**
   * Wrapper function for caching async operations
   */
  async withCache<T>(
    cache: MemoryCache<T>,
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = cache.get(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    try {
      const result = await fn();
      cache.set(key, result, ttl);
      return result;
    } catch (error) {
      // Don't cache errors
      throw error;
    }
  },

  /**
   * Invalidate cache entries that match a pattern
   */
  invalidatePattern(cache: MemoryCache<any>, pattern: string): number {
    let removed = 0;
    const regex = new RegExp(pattern);

    for (const key of cache["cache"].keys()) {
      if (regex.test(key)) {
        cache.delete(key);
        removed++;
      }
    }

    return removed;
  },

  /**
   * Get cache statistics for all cache instances
   */
  getAllStats() {
    return {
      workflow: workflowCache.getStats(),
      toolSearch: toolSearchCache.getStats(),
      taskDecomposition: taskDecompositionCache.getStats(),
    };
  },
};

// Periodic cleanup (runs every 5 minutes)
if (typeof window === "undefined") {
  setInterval(() => {
    workflowCache.cleanup();
    toolSearchCache.cleanup();
    taskDecompositionCache.cleanup();
  }, 5 * 60 * 1000);
}
