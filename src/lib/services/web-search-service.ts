import axios from "axios";
import { logger } from "@/lib/logger/structured-logger";

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
}

interface WebSearchResponse {
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
  isFallback: boolean;
}

interface SearchCacheEntry {
  results: SearchResult[];
  totalResults: number;
  cachedAt: number;
  expiresAt: number;
}

// In-memory cache for search results (24 hours)
const searchCache = new Map<string, SearchCacheEntry>();

// Cache cleanup interval (every hour)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of searchCache.entries()) {
    if (now > entry.expiresAt) {
      searchCache.delete(key);
    }
  }
}, 60 * 60 * 1000);

export class WebSearchService {
  private static instance: WebSearchService;
  private baseUrl: string;
  private apiKey: string;

  private constructor() {
    // Using Serper API as it's more cost-effective than Google Search API
    this.baseUrl = "https://google.serper.dev/search";
    this.apiKey = process.env.SERPER_API_KEY || "";

    if (!this.apiKey) {
      logger.warn(
        "SERPER_API_KEY not found. Web search functionality will be limited."
      );
    }
  }

  static getInstance(): WebSearchService {
    if (!WebSearchService.instance) {
      WebSearchService.instance = new WebSearchService();
    }
    return WebSearchService.instance;
  }

  /**
   * Generate cache key for search query
   */
  private generateCacheKey(query: string, language: string = "en"): string {
    return `search:${language}:${query.toLowerCase().trim()}`;
  }

  /**
   * Check if cached result is still valid
   */
  private getCachedResult(cacheKey: string): SearchResult[] | null {
    const cached = searchCache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    if (now > cached.expiresAt) {
      searchCache.delete(cacheKey);
      return null;
    }

    // logger.info("Search cache hit", { cacheKey, cachedAt: cached.cachedAt });
    return cached.results;
  }

  /**
   * Cache search results
   */
  private setCachedResult(cacheKey: string, results: SearchResult[]): void {
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

    searchCache.set(cacheKey, {
      results,
      totalResults: results.length,
      cachedAt: now,
      expiresAt,
    });
  }

  /**
   * Search for tool usage guides and documentation
   */
  async searchToolGuides(
    toolName: string,
    taskContext: string,
    language: string = "en"
  ): Promise<WebSearchResponse> {
    const startTime = Date.now();

    // Construct search query for tool guides
    const query = this.constructSearchQuery(toolName, taskContext, language);
    const cacheKey = this.generateCacheKey(query, language);
    // Check cache first
    const cachedResults = this.getCachedResult(cacheKey);
    if (cachedResults) {
      return {
        results: cachedResults,
        totalResults: cachedResults.length,
        searchTime: Date.now() - startTime,
        isFallback: false,
      };
    }

    // Fallback to mock results if API key is not available
    if (!this.apiKey) {
      logger.warn("No API key available, returning mock search results");
      return {
        results: [],
        totalResults: 0,
        searchTime: Date.now() - startTime,
        isFallback: true,
      };
    }

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          q: query,
          num: 8, // Get more results for better selection
          hl: "en",
          gl: "us",
        },
        {
          headers: {
            "X-API-KEY": this.apiKey,
            "Content-Type": "application/json",
          },
          timeout: 10000, // 10 second timeout
        }
      );

      const searchResults = this.parseSerperResponse(response.data);
      const filteredResults = this.filterRelevantResults(
        searchResults,
        toolName
      );

      // Cache the results
      this.setCachedResult(cacheKey, filteredResults);

      const searchTime = Date.now() - startTime;

      return {
        results: filteredResults,
        totalResults: filteredResults.length,
        searchTime,
        isFallback: false,
      };
    } catch (error) {
      logger.error("Web search failed", {
        toolName,
        query,
        error: error instanceof Error ? error.message : String(error),
        searchTime: Date.now() - startTime,
      });

      return {
        results: [],
        totalResults: 0,
        searchTime: Date.now() - startTime,
        isFallback: true,
      };
    }
  }

  /**
   * Construct optimized search query for tool guides
   */
  private constructSearchQuery(
    toolName: string,
    taskContext: string,
    language: string
  ): string {
    // Always search in English for better global results
    return `${toolName} tutorial guide how to use ${taskContext}`;
  }

  /**
   * Parse Serper API response into our standard format
   */
  private parseSerperResponse(data: any): SearchResult[] {
    if (!data.organic) return [];

    return data.organic.map((item: any) => ({
      title: item.title || "",
      link: item.link || "",
      snippet: item.snippet || "",
      date: item.date,
    }));
  }

  /**
   * Filter search results for relevance to the tool
   */
  private filterRelevantResults(
    results: SearchResult[],
    toolName: string
  ): SearchResult[] {
    const toolNameLower = toolName.toLowerCase();

    return results
      .filter((result) => {
        const title = result.title.toLowerCase();
        const snippet = result.snippet.toLowerCase();

        // Must contain tool name
        if (
          !title.includes(toolNameLower) &&
          !snippet.includes(toolNameLower)
        ) {
          return false;
        }

        // Prefer official documentation, tutorials, guides
        const isRelevant =
          title.includes("tutorial") ||
          title.includes("guide") ||
          title.includes("documentation") ||
          title.includes("how to") ||
          snippet.includes("tutorial") ||
          snippet.includes("guide") ||
          snippet.includes("사용법") ||
          snippet.includes("가이드") ||
          snippet.includes("튜토리얼");

        return isRelevant;
      })
      .slice(0, 5); // Limit to top 5 most relevant results
  }

  /**
   * Extract main content from a webpage (simplified version)
   */
  async extractWebContent(url: string): Promise<string | null> {
    try {
      const response = await axios.get(url, {
        timeout: 8000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; WorkflowAI/1.0; +https://workflow-ai.com/bot)",
        },
      });

      // Simple content extraction (in a real implementation, you might want to use Cheerio)
      const content = response.data;

      // Extract text content (very basic implementation)
      const textContent = content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return textContent.length > 100
        ? textContent.substring(0, 2000)
        : textContent;
    } catch (error) {
      logger.error("Failed to extract web content", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Clear cache (for testing or manual cache management)
   */
  clearCache(): void {
    searchCache.clear();
    logger.info("Search cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: searchCache.size,
      entries: Array.from(searchCache.keys()),
    };
  }
}

export const webSearchService = WebSearchService.getInstance();
