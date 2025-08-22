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

    logger.info("Search cache hit", { cacheKey, cachedAt: cached.cachedAt });
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

    logger.info("Search results cached", {
      cacheKey,
      resultCount: results.length,
      expiresAt: new Date(expiresAt).toISOString(),
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

    logger.info("Starting web search for tool guides", {
      toolName,
      taskContext,
      query,
      language,
    });

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
      return this.getMockSearchResults(toolName, taskContext);
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

      logger.info("Web search completed successfully", {
        toolName,
        query,
        resultCount: filteredResults.length,
        searchTime,
      });

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

      // Return mock results as fallback
      return this.getMockSearchResults(toolName, taskContext);
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
   * Generate mock search results for development/fallback
   */
  private getMockSearchResults(
    toolName: string,
    taskContext: string
  ): WebSearchResponse {
    const mockResults: SearchResult[] = [
      {
        title: `${toolName} 공식 사용 가이드 - 시작하기`,
        link: `https://${toolName.toLowerCase()}.com/docs/getting-started`,
        snippet: `${toolName}을 사용하여 ${taskContext} 작업을 수행하는 방법에 대한 공식 가이드입니다. 단계별로 설명된 튜토리얼을 통해 쉽게 시작할 수 있습니다.`,
      },
      {
        title: `${toolName} 튜토리얼 - ${taskContext} 프로젝트`,
        link: `https://tutorial.example.com/${toolName.toLowerCase()}-${taskContext}`,
        snippet: `실제 ${taskContext} 프로젝트를 통해 ${toolName}의 주요 기능을 배워보세요. 초보자도 쉽게 따라할 수 있는 상세한 설명을 제공합니다.`,
      },
      {
        title: `${toolName} 사용법 완벽 가이드`,
        link: `https://guide.example.com/${toolName.toLowerCase()}`,
        snippet: `${toolName}의 모든 기능을 활용하는 방법을 알아보세요. 기본 사용법부터 고급 기능까지 체계적으로 정리된 가이드입니다.`,
      },
    ];

    return {
      results: mockResults,
      totalResults: mockResults.length,
      searchTime: 100, // Mock search time
      isFallback: true,
    };
  }

  /**
   * Extract main content from a webpage (simplified version)
   */
  async extractWebContent(url: string): Promise<string | null> {
    try {
      logger.info("Extracting web content", { url });

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
