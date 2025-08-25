import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient } from "@supabase/supabase-js";
import { Document } from "@langchain/core/documents";
import { toolSearchCache, CacheUtils } from "@/lib/cache/memory-cache";
import { getEnvVar } from "@/lib/config/env-validation";
import {
  SearchStrategy,
  QueryType,
  RagDocument,
  RagSearchOptions,
  RagKnowledgeStats,
  RagEnhancedSearchResult,
  AdaptiveSearchResult,
  EnhancedSearchResponse,
  SearchPerformanceMetrics,
  RagSearchError,
  RagSearchErrorType,
  AdaptiveSearchParams
} from "@/types/rag-search";
import { ragErrorHandler } from "@/lib/utils/rag-error-handler";

// Initialize Supabase client with validated environment variables
const supabaseClient = createClient(
  getEnvVar("NEXT_PUBLIC_SUPABASE_URL"),
  getEnvVar("SUPABASE_SERVICE_ROLE_KEY")
);

// Initialize Google AI embeddings with consistent model
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004", // Latest model for consistency
  apiKey: getEnvVar("GOOGLE_API_KEY"),
});

// Create vector store instance
export const createVectorStore = () => {
  return new SupabaseVectorStore(embeddings, {
    client: supabaseClient,
    tableName: "tools",
    queryName: "match_tools",
  });
};

// Create retriever for tool recommendations
export const createToolRetriever = (k: number = 3) => {
  const vectorStore = createVectorStore();
  return vectorStore.asRetriever({ k });
};

// Fallback: Keyword-based tool search when vector search fails
export const searchToolsByKeywords = async (
  query: string,
  limit: number = 3,
  userPreferences?: {
    categories?: string[];
    difficulty_level?: string;
    budget_range?: string;
    freeToolsOnly?: boolean;
  }
): Promise<Document[]> => {
  try {
    // Clean query for safe searching
    const cleanQuery = query.replace(/[%,()]/g, " ").trim();

    // Try different search strategies
    let tools = null;
    let error = null;

    // Build query with free tools filter
    const buildQuery = (query: any) => {
      if (userPreferences?.freeToolsOnly) {
        // Filter for free tools using scores.pricing_model
        query = query.or(
          "scores->>pricing_model.eq.free"
        );
      }
      return query;
    };

    // Strategy 1: Simple name and description search
    ({ data: tools, error } = await buildQuery(
      supabaseClient
        .from("tools")
        .select("*")
        .eq("is_active", true)
        .ilike("name", `%${cleanQuery}%`)
    ).limit(limit));

    if (error || !tools || tools.length === 0) {
      // Strategy 2: Search in description
      ({ data: tools, error } = await buildQuery(
        supabaseClient
          .from("tools")
          .select("*")
          .eq("is_active", true)
          .ilike("description", `%${cleanQuery}%`)
      ).limit(limit));
    }

    if (error || !tools || tools.length === 0) {
      // Strategy 3: Search in embedding_text
      ({ data: tools, error } = await buildQuery(
        supabaseClient
          .from("tools")
          .select("*")
          .eq("is_active", true)
          .ilike("embedding_text", `%${cleanQuery}%`)
      ).limit(limit));
    }

    if (error || !tools || tools.length === 0) {
      // Ultimate fallback: return all active tools
      ({ data: tools, error } = await buildQuery(
        supabaseClient.from("tools").select("*").eq("is_active", true)
      ).limit(limit));
    }

    if (error) throw error;

    return (tools || []).map(
      (tool) =>
        new Document({
          pageContent: tool.embedding_text || tool.description || tool.name,
          metadata: {
            id: tool.id,
            name: tool.name,
            description: tool.description,
            url: tool.url,
            logo_url: tool.logo_url,
            categories: tool.categories,
            pros: [],
            cons: [],
            recommendation_tip: "",
          },
        })
    );
  } catch (error) {
    // Final fallback: return empty array
    return [];
  }
};

// Smart search using advanced database functions with multiple strategies
export const smartSearchTools = async (
  query: string,
  k: number = 3,
  userPreferences?: {
    categories?: string[];
    difficulty_level?: string;
    budget_range?: string;
  }
): Promise<Document[]> => {
  try {
    // Generate embedding for the query
    const queryEmbedding = await embeddings.embedQuery(query);

    // Use smart_search_tools database function
    const { data: results, error } = await supabaseClient.rpc(
      "smart_search_tools",
      {
        query_text: query,
        query_embedding: `[${queryEmbedding.join(",")}]`,
        match_count: k,
        user_preferences: userPreferences
          ? JSON.stringify(userPreferences)
          : "{}",
      }
    );

    if (error) throw error;

    if (results && results.length > 0) {
      return results.map(
        (result: any) =>
          new Document({
            pageContent: result.description || result.name,
            metadata: {
              id: result.id,
              name: result.name,
              description: result.description,
              url: result.url,
              logo_url: result.logo_url || "",
              categories: result.categories || [],
              pros: [],
              cons: [],
              recommendation_tip: "",
              search_strategy: result.search_strategy,
              score: result.score,
            },
          })
      );
    }

    // Fallback to keyword search
    return await searchToolsByKeywords(query, k, userPreferences);
  } catch (error) {
    console.warn("Smart search failed, falling back to keyword search:", error);
    return await searchToolsByKeywords(query, k, userPreferences);
  }
};

// Hybrid search combining vector and text search
export const hybridSearchTools = async (
  query: string,
  k: number = 3,
  userPreferences?: {
    categories?: string[];
    difficulty_level?: string;
    budget_range?: string;
    freeToolsOnly?: boolean;
  }
): Promise<Document[]> => {
  console.log("Hybrid search starting for query:", query);
  try {
    // Generate embedding for the query
    console.log("Generating embedding for query...");
    const queryEmbedding = await embeddings.embedQuery(query);
    console.log("Embedding generated, length:", queryEmbedding.length);

    // Use hybrid_search_tools database function
    console.log("Calling hybrid_search_tools RPC function...");
    const { data: results, error } = await supabaseClient.rpc(
      "hybrid_search_tools",
      {
        query_text: query,
        query_embedding: `[${queryEmbedding.join(",")}]`,
        match_count: k,
        vector_weight: 0.7,
        text_weight: 0.3,
      }
    );

    console.log("RPC call completed:", { 
      hasResults: !!results, 
      resultCount: results?.length || 0, 
      hasError: !!error 
    });

    if (error) {
      console.error("Hybrid search RPC error:", error);
      throw error;
    }

    if (results && results.length > 0) {
      console.log("Hybrid search found", results.length, "results");
      return results.map(
        (result: any) =>
          new Document({
            pageContent: result.description || result.name,
            metadata: {
              id: result.id,
              name: result.name,
              description: result.description,
              url: result.url,
              logo_url: result.logo_url || "",
              categories: result.categories || [],
              pros: [],
              cons: [],
              recommendation_tip: "",
              hybrid_score: result.hybrid_score,
              vector_similarity: result.vector_similarity,
              text_similarity: result.text_similarity,
            },
          })
      );
    }

    console.log("Hybrid search returned no results");
    // Fallback to keyword search
    return await searchToolsByKeywords(query, k, userPreferences);
  } catch (error) {
    console.warn(
      "Hybrid search failed, falling back to keyword search:",
      error
    );
    return await searchToolsByKeywords(query, k, userPreferences);
  }
};

// Enhanced retriever with smart fallback strategies and caching
export const getRelevantTools = async (
  query: string,
  k: number = 3,
  userPreferences?: {
    categories?: string[];
    difficulty_level?: string;
    budget_range?: string;
    freeToolsOnly?: boolean;
  }
): Promise<Document[]> => {
  console.log("=== GET RELEVANT TOOLS START ===", {
    query,
    k,
    userPreferences,
    timestamp: new Date().toISOString()
  });

  // Generate cache key based on query and preferences
  const cacheKey = CacheUtils.generateKey({
    query: query.toLowerCase().trim(),
    k,
    userPreferences,
  });

  // Try to get from cache first
  return await CacheUtils.withCache(toolSearchCache, cacheKey, async () => {
    console.log("Cache miss, performing search for:", query);

    // Strategy 1: Skip smart search for now (function not implemented)
    // TODO: Implement smart_search_tools function in database
    // if (userPreferences && Object.keys(userPreferences).length > 0) {
    //   const smartResults = await smartSearchTools(query, k, userPreferences);
    //   if (smartResults.length > 0) {
    //     return smartResults;
    //   }
    // }

    // Strategy 2: Try hybrid search
    console.log("Attempting hybrid search...");
    try {
      const hybridResults = await hybridSearchTools(query, k, userPreferences);
      console.log("Hybrid search results:", hybridResults.length);
      if (hybridResults.length > 0) {
        return hybridResults;
      }
    } catch (error) {
      console.error("Hybrid search failed:", error);
    }

    // Strategy 3: Fallback to original vector search
    console.log("Attempting vector search...");
    try {
      const vectorRetriever = createToolRetriever(k);
      const results = await vectorRetriever.getRelevantDocuments(query);
      console.log("Vector search results:", results.length);

      if (results.length > 0) {
        return results;
      }
    } catch (error) {
      console.error("Vector search failed:", error);
    }

    // Strategy 4: Final fallback to keyword search
    console.log("All advanced searches failed, using keyword search");
    const keywordResults = await searchToolsByKeywords(query, k, userPreferences);
    console.log("Keyword search results:", keywordResults.length);
    return keywordResults;
  });
};

// Helper function to add tools to vector store
export const addToolsToVectorStore = async (
  tools: {
    id: string;
    name: string;
    description: string;
    url: string;
    logoUrl: string;
    categories: string[];
    embeddingText: string;
  }[]
) => {
  const vectorStore = createVectorStore();

  const documents = tools.map(
    (tool) =>
      new Document({
        pageContent: tool.embeddingText,
        metadata: {
          id: tool.id,
          name: tool.name,
          description: tool.description,
          url: tool.url,
          logo_url: tool.logoUrl,
          categories: tool.categories,
          pros: [],
          cons: [],
          recommendation_tip: "",
        },
      })
  );

  await vectorStore.addDocuments(documents);
  return documents;
};

// RAG-enhanced search functions

/**
 * Get RAG knowledge base statistics
 */
export const getRagKnowledgeStats = async (): Promise<RagKnowledgeStats | null> => {
  try {
    const { data, error } = await supabaseClient.rpc('rag_knowledge_stats');
    
    if (error) {
      console.error('Failed to get RAG knowledge stats:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('RAG knowledge stats query failed:', error);
    return null;
  }
};

/**
 * Detect query type for adaptive search
 */
export const detectQueryType = (query: string): QueryType => {
  const queryLower = query.toLowerCase().trim();
  
  // Specific tool patterns
  if (queryLower.includes('best') && queryLower.includes('for')) {
    return QueryType.FUNCTIONAL;
  }
  
  // Category-based queries
  const categoryKeywords = [
    'design', 'development', 'analytics', 'communication',
    'productivity', 'marketing', 'finance', 'project management'
  ];
  
  if (categoryKeywords.some(keyword => queryLower.includes(keyword))) {
    return QueryType.CATEGORY;
  }
  
  // Specific tool mentions (brand names, specific tools)
  const toolNamePatterns = [
    /\b(figma|canva|notion|slack|github|jira|asana)\b/i,
    /\balternative to\b/i,
    /\blike\s+\w+\s+(but|except)\b/i
  ];
  
  if (toolNamePatterns.some(pattern => pattern.test(queryLower))) {
    return QueryType.SPECIFIC_TOOL;
  }
  
  return QueryType.GENERAL;
};

/**
 * Get adaptive search parameters based on query type
 */
export const getAdaptiveSearchParams = (queryType: QueryType): AdaptiveSearchParams => {
  switch (queryType) {
    case QueryType.SPECIFIC_TOOL:
      return {
        query_type: queryType,
        knowledge_weight: 0.5,
        context_weight: 0.3,
        semantic_weight: 0.2,
        confidence_threshold: 0.7
      };
    
    case QueryType.FUNCTIONAL:
      return {
        query_type: queryType,
        knowledge_weight: 0.4,
        context_weight: 0.4,
        semantic_weight: 0.2,
        confidence_threshold: 0.6
      };
    
    case QueryType.CATEGORY:
      return {
        query_type: queryType,
        knowledge_weight: 0.3,
        context_weight: 0.3,
        semantic_weight: 0.4,
        confidence_threshold: 0.5
      };
    
    case QueryType.GENERAL:
    default:
      return {
        query_type: queryType,
        knowledge_weight: 0.35,
        context_weight: 0.35,
        semantic_weight: 0.3,
        confidence_threshold: 0.4
      };
  }
};

/**
 * RAG-enhanced tool search using the main database function
 */
export const ragEnhancedSearchTools = async (
  options: RagSearchOptions
): Promise<RagDocument[]> => {
  const startTime = Date.now();
  
  try {
    console.log('RAG-enhanced search starting:', {
      query: options.query_text,
      match_count: options.match_count || 3,
      use_adaptive_weights: options.use_adaptive_weights || false
    });
    
    // Generate embedding if not provided
    let queryEmbedding = options.query_embedding;
    if (!queryEmbedding) {
      queryEmbedding = await embeddings.embedQuery(options.query_text);
    }
    
    // Call the RAG-enhanced search database function
    const { data: results, error } = await supabaseClient.rpc(
      'rag_enhanced_tool_search',
      {
        query_text: options.query_text,
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_count: options.match_count || 3,
        knowledge_weight: options.knowledge_weight || 0.4,
        context_weight: options.context_weight || 0.35,
        semantic_weight: options.semantic_weight || 0.25
      }
    );
    
    if (error) {
      console.error('RAG-enhanced search RPC error:', error);
      throw new RagSearchError(
        RagSearchErrorType.DATABASE_FUNCTION_NOT_FOUND,
        `RAG search failed: ${error.message}`,
        { error, options }
      );
    }
    
    if (!results || results.length === 0) {
      console.log('RAG-enhanced search returned no results');
      return [];
    }
    
    console.log(`RAG-enhanced search found ${results.length} results in ${Date.now() - startTime}ms`);
    
    // Convert to RagDocument format
    return results.map((result: RagEnhancedSearchResult) => {
      const doc: RagDocument = new Document({
        pageContent: result.description || result.name,
        metadata: {
          id: result.id,
          name: result.name,
          description: result.description,
          url: result.url,
          logo_url: result.logo_url || '',
          categories: result.categories || [],
          pros: [],
          cons: [],
          recommendation_tip: '',
          // RAG-enhanced metadata
          rag_score: result.rag_score,
          knowledge_relevance: result.knowledge_relevance,
          context_alignment: result.context_alignment,
          semantic_similarity: result.semantic_similarity,
          search_strategy: SearchStrategy.RAG_ENHANCED,
          reasoning: result.reasoning,
          confidence_score: result.confidence_score,
          quality_indicators: {
            has_benchmarks: false, // Will be populated from scores if available
            has_user_ratings: false,
            knowledge_coverage: result.knowledge_relevance,
            recency_score: 0.8 // Default value
          }
        }
      }) as RagDocument;
      
      return doc;
    });
    
  } catch (error) {
    console.error('RAG-enhanced search failed:', error);
    if (error instanceof RagSearchError) {
      throw error;
    }
    throw new RagSearchError(
      RagSearchErrorType.QUERY_PARSING_FAILED,
      `RAG search error: ${error instanceof Error ? error.message : String(error)}`,
      { error, options }
    );
  }
};

/**
 * Adaptive tool search that adjusts weights based on query type
 */
export const adaptiveSearchTools = async (
  options: RagSearchOptions
): Promise<RagDocument[]> => {
  const startTime = Date.now();
  
  try {
    console.log('Adaptive search starting:', {
      query: options.query_text,
      match_count: options.match_count || 3
    });
    
    // Detect query type
    const queryType = detectQueryType(options.query_text);
    const adaptiveParams = getAdaptiveSearchParams(queryType);
    
    console.log('Query type detected:', { queryType, adaptiveParams });
    
    // Generate embedding if not provided
    let queryEmbedding = options.query_embedding;
    if (!queryEmbedding) {
      queryEmbedding = await embeddings.embedQuery(options.query_text);
    }
    
    // Call the adaptive search database function
    const { data: results, error } = await supabaseClient.rpc(
      'adaptive_tool_search',
      {
        query_text: options.query_text,
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_count: options.match_count || 3,
        query_type: queryType,
        knowledge_weight: adaptiveParams.knowledge_weight,
        context_weight: adaptiveParams.context_weight,
        semantic_weight: adaptiveParams.semantic_weight
      }
    );
    
    if (error) {
      console.error('Adaptive search RPC error:', error);
      throw new RagSearchError(
        RagSearchErrorType.DATABASE_FUNCTION_NOT_FOUND,
        `Adaptive search failed: ${error.message}`,
        { error, options, queryType }
      );
    }
    
    if (!results || results.length === 0) {
      console.log('Adaptive search returned no results');
      return [];
    }
    
    console.log(`Adaptive search found ${results.length} results in ${Date.now() - startTime}ms`);
    
    // Convert to RagDocument format
    return results.map((result: AdaptiveSearchResult) => {
      const doc: RagDocument = new Document({
        pageContent: result.description || result.name,
        metadata: {
          id: result.id,
          name: result.name,
          description: result.description,
          url: result.url,
          logo_url: result.logo_url || '',
          categories: result.categories || [],
          pros: [],
          cons: [],
          recommendation_tip: '',
          // Adaptive search metadata
          rag_score: result.adaptive_score,
          search_strategy: SearchStrategy.ADAPTIVE,
          query_type: result.query_type as QueryType,
          reasoning: result.reasoning,
          confidence_score: result.confidence_score,
          quality_indicators: {
            has_benchmarks: false,
            has_user_ratings: false,
            knowledge_coverage: result.knowledge_weight,
            recency_score: 0.8
          }
        }
      }) as RagDocument;
      
      return doc;
    });
    
  } catch (error) {
    console.error('Adaptive search failed:', error);
    if (error instanceof RagSearchError) {
      throw error;
    }
    throw new RagSearchError(
      RagSearchErrorType.QUERY_PARSING_FAILED,
      `Adaptive search error: ${error instanceof Error ? error.message : String(error)}`,
      { error, options }
    );
  }
};

/**
 * Enhanced getRelevantTools with RAG-enhanced search as the primary strategy
 */
export const getRelevantToolsWithRAG = async (
  query: string,
  k: number = 3,
  userPreferences?: {
    categories?: string[];
    difficulty_level?: string;
    budget_range?: string;
    freeToolsOnly?: boolean;
  },
  options: {
    enableRAG?: boolean;
    enableAdaptive?: boolean;
    fallbackStrategy?: SearchStrategy[];
    minConfidenceThreshold?: number;
  } = {}
): Promise<RagDocument[]> => {
  console.log('=== GET RELEVANT TOOLS WITH RAG START ===', {
    query,
    k,
    userPreferences,
    options,
    timestamp: new Date().toISOString()
  });
  
  // Generate cache key based on query, preferences, and options
  const cacheKey = CacheUtils.generateKey({
    query: query.toLowerCase().trim(),
    k,
    userPreferences,
    ragEnabled: options.enableRAG !== false,
    adaptiveEnabled: options.enableAdaptive !== false
  });
  
  return await CacheUtils.withCache(toolSearchCache, cacheKey, async () => {
    console.log('Cache miss, performing RAG-enhanced search for:', query);
    
    const fallbackStrategies = options.fallbackStrategy || [
      SearchStrategy.RAG_ENHANCED,
      SearchStrategy.ADAPTIVE,
      SearchStrategy.HYBRID,
      SearchStrategy.VECTOR,
      SearchStrategy.KEYWORD
    ];
    
    const minConfidence = options.minConfidenceThreshold || 0.3;
    
    // Try each strategy in the fallback chain with error handling
    for (const strategy of fallbackStrategies) {
      try {
        console.log(`Attempting search strategy: ${strategy}`);
        let results: RagDocument[] = [];
        
        // Use error handler to execute search with retry logic
        results = await ragErrorHandler.executeWithRetry(
          async () => {
            switch (strategy) {
              case SearchStrategy.RAG_ENHANCED:
                if (options.enableRAG !== false) {
                  return await ragEnhancedSearchTools({
                    query_text: query,
                    match_count: k,
                    user_preferences: userPreferences
                  });
                }
                return [];
                
              case SearchStrategy.ADAPTIVE:
                if (options.enableAdaptive !== false) {
                  return await adaptiveSearchTools({
                    query_text: query,
                    match_count: k,
                    user_preferences: userPreferences
                  });
                }
                return [];
                
              case SearchStrategy.HYBRID:
                // Convert to legacy Document[] and then back to RagDocument[]
                const hybridResults = await hybridSearchTools(query, k, userPreferences);
                return hybridResults.map(doc => {
                  const ragDoc = doc as RagDocument;
                  if (ragDoc.metadata) {
                    ragDoc.metadata.search_strategy = SearchStrategy.HYBRID;
                  }
                  return ragDoc;
                });
                
              case SearchStrategy.VECTOR:
                const vectorRetriever = createToolRetriever(k);
                const vectorResults = await vectorRetriever.getRelevantDocuments(query);
                return vectorResults.map(doc => {
                  const ragDoc = doc as RagDocument;
                  if (ragDoc.metadata) {
                    ragDoc.metadata.search_strategy = SearchStrategy.VECTOR;
                  }
                  return ragDoc;
                });
                
              case SearchStrategy.KEYWORD:
                const keywordResults = await searchToolsByKeywords(query, k, userPreferences);
                return keywordResults.map(doc => {
                  const ragDoc = doc as RagDocument;
                  if (ragDoc.metadata) {
                    ragDoc.metadata.search_strategy = SearchStrategy.KEYWORD;
                  }
                  return ragDoc;
                });
                
              default:
                return [];
            }
          },
          {
            taskName: query,
            strategy,
            userPreferences,
            timestamp: new Date().toISOString()
          },
          2 // max retries for fallback strategies
        );
        
        if (results.length > 0) {
          // Check confidence threshold for RAG and Adaptive strategies
          if ([SearchStrategy.RAG_ENHANCED, SearchStrategy.ADAPTIVE].includes(strategy)) {
            const avgConfidence = results.reduce((sum, doc) => 
              sum + (doc.metadata.confidence_score || 0), 0) / results.length;
            
            if (avgConfidence >= minConfidence) {
              console.log(`Strategy ${strategy} succeeded with confidence ${avgConfidence.toFixed(3)}`);
              return results;
            } else {
              console.log(`Strategy ${strategy} confidence ${avgConfidence.toFixed(3)} below threshold ${minConfidence}`);
              continue;
            }
          } else {
            // For legacy strategies, accept any results
            console.log(`Strategy ${strategy} succeeded with ${results.length} results`);
            return results;
          }
        }
        
      } catch (error) {
        // Handle error with intelligent fallback decision
        const errorHandlingResult = await ragErrorHandler.handleSearchError(
          error as Error,
          {
            taskName: query,
            strategy,
            userPreferences,
            timestamp: new Date().toISOString()
          },
          fallbackStrategies
        );

        console.error(`Strategy ${strategy} failed:`, {
          error: error instanceof Error ? error.message : String(error),
          errorCategory: errorHandlingResult.errorCategory,
          nextStrategy: errorHandlingResult.nextStrategy,
          retryRecommended: errorHandlingResult.retryRecommended
        });

        // If this was the recommended next strategy, skip to it
        if (errorHandlingResult.nextStrategy) {
          const nextIndex = fallbackStrategies.indexOf(errorHandlingResult.nextStrategy);
          if (nextIndex > fallbackStrategies.indexOf(strategy)) {
            // Skip to the recommended next strategy
            continue;
          }
        }
      }
    }
    
    // All strategies failed
    console.warn('All search strategies failed, returning empty results');
    return [];
  });
};

/**
 * Advanced Hybrid Search - 문서 설계서에 따른 메인 검색 함수
 * tools 테이블과 rag_knowledge_chunks 테이블을 결합하여 최고의 정확도 달성
 */
export const advancedHybridSearch = async (
  query: string,
  k: number = 3,
  traditionalWeight: number = 0.6,
  ragWeight: number = 0.4,
  userPreferences?: {
    categories?: string[];
    difficulty_level?: string;
    budget_range?: string;
    freeToolsOnly?: boolean;
  }
): Promise<RagDocument[]> => {
  const startTime = Date.now();
  
  console.log('=== ADVANCED HYBRID SEARCH START ===', {
    query,
    k,
    traditionalWeight,
    ragWeight,
    userPreferences,
    timestamp: new Date().toISOString()
  });

  try {
    // Generate query embedding
    const queryEmbedding = await embeddings.embedQuery(query);
    
    // Call the database function
    const { data: results, error } = await supabaseClient.rpc(
      'advanced_hybrid_search',
      {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        query_text: query,
        traditional_weight: traditionalWeight,
        rag_weight: ragWeight,
        match_count: k
      }
    );
    
    if (error) {
      console.error('Advanced hybrid search RPC error:', error);
      throw error;
    }
    
    if (!results || results.length === 0) {
      console.log('Advanced hybrid search returned no results, falling back');
      // Fallback to existing hybrid search
      const fallbackResults = await hybridSearchTools(query, k, userPreferences);
      return fallbackResults.map(doc => convertToRagDocument(doc, SearchStrategy.HYBRID));
    }
    
    console.log(`Advanced hybrid search found ${results.length} results in ${Date.now() - startTime}ms`);
    
    // Convert to RagDocument format
    return results.map((result: any) => {
      const doc: RagDocument = new Document({
        pageContent: result.description || result.name,
        metadata: {
          id: result.id,
          name: result.name,
          description: result.description,
          url: result.url,
          logo_url: result.logo_url || '',
          categories: result.categories || [],
          domains: result.domains || [],
          pros: [],
          cons: [],
          recommendation_tip: '',
          // Hybrid search metadata
          traditional_score: result.traditional_score,
          rag_score: result.rag_score,
          final_score: result.final_score,
          search_strategy: result.search_strategy === 'hybrid_rag' ? SearchStrategy.RAG_ENHANCED : SearchStrategy.HYBRID,
          confidence_score: Math.min(1, Math.max(0, result.final_score)),
          quality_indicators: {
            has_benchmarks: false,
            has_user_ratings: false,
            knowledge_coverage: result.rag_score,
            recency_score: 0.8
          }
        }
      }) as RagDocument;
      
      return doc;
    });
    
  } catch (error) {
    console.error('Advanced hybrid search failed:', error);
    
    // Ultimate fallback to existing hybrid search
    console.log('Falling back to existing hybrid search');
    const fallbackResults = await hybridSearchTools(query, k, userPreferences);
    return fallbackResults.map(doc => convertToRagDocument(doc, SearchStrategy.HYBRID));
  }
};

// Enhanced search result conversion utilities
export const convertToRagDocument = (doc: Document, strategy: SearchStrategy): RagDocument => {
  const ragDoc = doc as RagDocument;
  if (ragDoc.metadata) {
    ragDoc.metadata.search_strategy = strategy;
    if (!ragDoc.metadata.confidence_score) {
      ragDoc.metadata.confidence_score = 0.5; // Default confidence
    }
    if (!ragDoc.metadata.quality_indicators) {
      ragDoc.metadata.quality_indicators = {
        has_benchmarks: false,
        has_user_ratings: false,
        knowledge_coverage: 0.5,
        recency_score: 0.8
      };
    }
  }
  return ragDoc;
};
