import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { createClient } from "@supabase/supabase-js";
import { Document } from "@langchain/core/documents";

// Initialize Supabase client with service role key for server-side operations
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Google AI embeddings
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  apiKey: process.env.GOOGLE_API_KEY,
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
  limit: number = 3
): Promise<Document[]> => {
  try {
    // Clean query for safe searching
    const cleanQuery = query.replace(/[%,()]/g, " ").trim();

    // Try different search strategies
    let tools = null;
    let error = null;

    // Strategy 1: Simple name and description search
    ({ data: tools, error } = await supabaseClient
      .from("tools")
      .select("*")
      .eq("is_active", true)
      .ilike("name", `%${cleanQuery}%`)
      .limit(limit));

    if (error || !tools || tools.length === 0) {
      // Strategy 2: Search in description
      ({ data: tools, error } = await supabaseClient
        .from("tools")
        .select("*")
        .eq("is_active", true)
        .ilike("description", `%${cleanQuery}%`)
        .limit(limit));
    }

    if (error || !tools || tools.length === 0) {
      // Strategy 3: Search in embedding_text
      ({ data: tools, error } = await supabaseClient
        .from("tools")
        .select("*")
        .eq("is_active", true)
        .ilike("embedding_text", `%${cleanQuery}%`)
        .limit(limit));
    }

    if (error || !tools || tools.length === 0) {
      // Ultimate fallback: return all active tools
      ({ data: tools, error } = await supabaseClient
        .from("tools")
        .select("*")
        .eq("is_active", true)
        .limit(limit));
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
            pros: tool.pros,
            cons: tool.cons,
            recommendation_tip: tool.recommendation_tip,
          },
        })
    );
  } catch (error) {
    // Final fallback: return empty array
    return [];
  }
};

// Enhanced retriever with fallback (temporarily using keyword search only)
export const getRelevantTools = async (
  query: string,
  k: number = 3
): Promise<Document[]> => {
  // Temporarily disable vector search until match_tools function is properly set up
  return await searchToolsByKeywords(query, k);

  /* TODO: Re-enable vector search once match_tools function is properly configured
  try {
    // Try vector search first
    const vectorRetriever = createToolRetriever(k);
    const results = await vectorRetriever.getRelevantDocuments(query);

    if (results.length > 0) {
      return results;
    }

    // Fallback to keyword search
    return await searchToolsByKeywords(query, k);
  } catch (error) {
    // Fallback to keyword search
    return await searchToolsByKeywords(query, k);
  }
  */
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
    pros: string[];
    cons: string[];
    embeddingText: string;
    recommendationTip: string;
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
          pros: tool.pros,
          cons: tool.cons,
          recommendation_tip: tool.recommendationTip,
        },
      })
  );

  await vectorStore.addDocuments(documents);
  return documents;
};
