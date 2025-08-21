import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient } from "@supabase/supabase-js";
import { Document } from "@langchain/core/documents";
import { toolSearchCache, CacheUtils } from "@/lib/cache/memory-cache";
import { getEnvVar } from "@/lib/config/env-validation";

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
        // Prefer scores.pricing_model when available, fallback to cost_index
        query = query.or(
          "scores->>pricing_model.eq.free,cost_index.is.null,cost_index.eq.0"
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
  try {
    // Generate embedding for the query
    const queryEmbedding = await embeddings.embedQuery(query);

    // Use hybrid_search_tools database function
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
              hybrid_score: result.hybrid_score,
              vector_similarity: result.vector_similarity,
              text_similarity: result.text_similarity,
            },
          })
      );
    }

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
  // Generate cache key based on query and preferences
  const cacheKey = CacheUtils.generateKey({
    query: query.toLowerCase().trim(),
    k,
    userPreferences,
  });

  // Try to get from cache first
  return await CacheUtils.withCache(toolSearchCache, cacheKey, async () => {
    // Strategy 1: Skip smart search for now (function not implemented)
    // TODO: Implement smart_search_tools function in database
    // if (userPreferences && Object.keys(userPreferences).length > 0) {
    //   const smartResults = await smartSearchTools(query, k, userPreferences);
    //   if (smartResults.length > 0) {
    //     return smartResults;
    //   }
    // }

    // Strategy 2: Try hybrid search
    const hybridResults = await hybridSearchTools(query, k, userPreferences);
    if (hybridResults.length > 0) {
      return hybridResults;
    }

    // Strategy 3: Fallback to original vector search
    try {
      const vectorRetriever = createToolRetriever(k);
      const results = await vectorRetriever.getRelevantDocuments(query);

      if (results.length > 0) {
        return results;
      }
    } catch (error) {
      console.warn("Vector search failed:", error);
    }

    // Strategy 4: Final fallback to keyword search
    console.warn("All advanced searches failed, using keyword search");
    return await searchToolsByKeywords(query, k, userPreferences);
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
