/**
 * TypeScript interfaces for RAG-enhanced search functionality
 */

import { Document } from "@langchain/core/documents";

/**
 * Search strategies enum for fallback chain
 */
export enum SearchStrategy {
  RAG_ENHANCED = "rag_enhanced",
  ADAPTIVE = "adaptive", 
  HYBRID = "hybrid",
  VECTOR = "vector",
  KEYWORD = "keyword"
}

/**
 * Query type classification for adaptive search
 */
export enum QueryType {
  SPECIFIC_TOOL = "specific_tool",
  FUNCTIONAL = "functional", 
  CATEGORY = "category",
  GENERAL = "general"
}

/**
 * RAG knowledge base statistics
 */
export interface RagKnowledgeStats {
  total_knowledge_entries: number;
  avg_embedding_dimension: number;
  last_updated: string;
  coverage_by_category: Record<string, number>;
  knowledge_quality_score: number;
}

/**
 * Enhanced search result with RAG-specific metadata
 */
export interface RagSearchResult {
  id: string;
  name: string;
  description: string;
  url: string;
  logo_url?: string;
  categories: string[];
  
  // RAG-enhanced scoring
  rag_score: number;
  knowledge_relevance: number;
  context_alignment: number;
  semantic_similarity: number;
  
  // Search metadata
  search_strategy: SearchStrategy;
  query_type?: QueryType;
  knowledge_sources?: string[];
  reasoning?: string;
  
  // Quality indicators
  confidence_score: number;
  quality_indicators: {
    has_benchmarks: boolean;
    has_user_ratings: boolean;
    knowledge_coverage: number;
    recency_score: number;
  };
  
  // Legacy compatibility
  hybrid_score?: number;
  vector_similarity?: number;
  text_similarity?: number;
  score?: number;
}

/**
 * RAG-enhanced search options
 */
export interface RagSearchOptions {
  // Search parameters
  query_text: string;
  query_embedding?: number[];
  match_count?: number;
  
  // RAG-specific parameters
  knowledge_weight?: number;
  context_weight?: number;
  semantic_weight?: number;
  use_adaptive_weights?: boolean;
  
  // User preferences
  user_preferences?: {
    categories?: string[];
    difficulty_level?: string;
    budget_range?: string;
    freeToolsOnly?: boolean;
  };
  
  // Search strategy preferences
  preferred_strategy?: SearchStrategy;
  enable_fallback?: boolean;
  fallback_threshold?: number;
}

/**
 * Adaptive search parameters based on query analysis
 */
export interface AdaptiveSearchParams {
  query_type: QueryType;
  knowledge_weight: number;
  context_weight: number; 
  semantic_weight: number;
  confidence_threshold: number;
}

/**
 * Enhanced Document interface with RAG metadata
 */
export interface RagDocument extends Document {
  metadata: {
    // Standard metadata
    id: string;
    name: string;
    description: string;
    url: string;
    logo_url?: string;
    categories: string[];
    pros: string[];
    cons: string[];
    recommendation_tip: string;
    
    // RAG-enhanced metadata
    rag_score?: number;
    knowledge_relevance?: number;
    context_alignment?: number;
    semantic_similarity?: number;
    search_strategy?: SearchStrategy;
    query_type?: QueryType;
    knowledge_sources?: string[];
    reasoning?: string;
    confidence_score?: number;
    quality_indicators?: {
      has_benchmarks: boolean;
      has_user_ratings: boolean;
      knowledge_coverage: number;
      recency_score: number;
    };
    
    // Legacy compatibility
    hybrid_score?: number;
    vector_similarity?: number;
    text_similarity?: number;
    score?: number;
  };
}

/**
 * Database function result interfaces
 */
export interface RagEnhancedSearchResult {
  id: string;
  name: string;
  description: string;
  url: string;
  logo_url: string;
  categories: string[];
  rag_score: number;
  knowledge_relevance: number;
  context_alignment: number;
  semantic_similarity: number;
  search_strategy: string;
  reasoning: string;
  confidence_score: number;
}

export interface AdaptiveSearchResult {
  id: string;
  name: string;
  description: string;
  url: string;
  logo_url: string;
  categories: string[];
  adaptive_score: number;
  query_type: string;
  knowledge_weight: number;
  context_weight: number;
  semantic_weight: number;
  reasoning: string;
  confidence_score: number;
}

/**
 * Search performance metrics
 */
export interface SearchPerformanceMetrics {
  strategy_used: SearchStrategy;
  search_duration: number;
  results_count: number;
  avg_confidence_score: number;
  fallback_applied: boolean;
  fallback_reason?: string;
  cache_hit: boolean;
}

/**
 * Enhanced search context for comprehensive search operations
 */
export interface EnhancedSearchContext {
  // Basic context
  query: string;
  user_preferences?: RagSearchOptions['user_preferences'];
  
  // Performance requirements
  max_results?: number;
  timeout_ms?: number;
  
  // Strategy preferences
  preferred_strategies?: SearchStrategy[];
  min_confidence_threshold?: number;
  
  // Caching
  use_cache?: boolean;
  cache_ttl?: number;
  
  // Debugging
  include_debug_info?: boolean;
  log_performance?: boolean;
}

/**
 * Comprehensive search response
 */
export interface EnhancedSearchResponse {
  // Results
  results: RagDocument[];
  
  // Metadata
  search_metadata: {
    strategy_used: SearchStrategy;
    query_type?: QueryType;
    total_candidates_evaluated: number;
    final_results_count: number;
    avg_confidence_score: number;
  };
  
  // Performance
  performance: SearchPerformanceMetrics;
  
  // Quality indicators
  quality_assessment: {
    result_quality_score: number;
    coverage_score: number;
    relevance_score: number;
    diversity_score: number;
  };
  
  // Debug information (optional)
  debug_info?: {
    fallback_chain?: SearchStrategy[];
    rejected_strategies?: { strategy: SearchStrategy; reason: string }[];
    query_analysis?: {
      detected_type: QueryType;
      confidence: number;
      key_terms: string[];
    };
  };
}

/**
 * Error types for RAG search operations
 */
export enum RagSearchErrorType {
  EMBEDDING_GENERATION_FAILED = "embedding_generation_failed",
  DATABASE_FUNCTION_NOT_FOUND = "database_function_not_found", 
  INSUFFICIENT_KNOWLEDGE_BASE = "insufficient_knowledge_base",
  QUERY_PARSING_FAILED = "query_parsing_failed",
  TIMEOUT_EXCEEDED = "timeout_exceeded",
  FALLBACK_EXHAUSTED = "fallback_exhausted"
}

export class RagSearchError extends Error {
  constructor(
    public type: RagSearchErrorType,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "RagSearchError";
  }
}

/**
 * Configuration for RAG search system
 */
export interface RagSearchConfig {
  // Default weights
  default_knowledge_weight: number;
  default_context_weight: number;
  default_semantic_weight: number;
  
  // Thresholds
  min_confidence_threshold: number;
  fallback_threshold: number;
  
  // Performance limits
  max_search_duration: number;
  max_candidates: number;
  
  // Cache settings
  cache_enabled: boolean;
  cache_ttl_seconds: number;
  
  // Feature flags
  adaptive_search_enabled: boolean;
  knowledge_stats_enabled: boolean;
  debug_mode: boolean;
}