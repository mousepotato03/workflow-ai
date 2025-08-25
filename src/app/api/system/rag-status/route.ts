import { NextResponse } from "next/server";
import { ragErrorHandler } from "@/lib/utils/rag-error-handler";
import { getRagKnowledgeStats } from "@/lib/supabase/vector-store";
import { createClient } from "@supabase/supabase-js";
import { getEnvVar } from "@/lib/config/env-validation";

const supabase = createClient(
  getEnvVar("NEXT_PUBLIC_SUPABASE_URL"),
  getEnvVar("SUPABASE_SERVICE_ROLE_KEY")
);

/**
 * GET /api/system/rag-status
 * Get comprehensive status of RAG-enhanced search system
 */
export async function GET() {
  try {
    const startTime = Date.now();

    // Get error handler statistics
    const errorStats = ragErrorHandler.getFailureStats();

    // Get RAG knowledge base statistics
    const knowledgeStats = await getRagKnowledgeStats();

    // Test database functions availability
    const functionTests = await testDatabaseFunctions();

    // Calculate overall health score
    const healthScore = calculateHealthScore({
      errorStats,
      knowledgeStats,
      functionTests
    });

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        system: {
          status: healthScore >= 0.7 ? "healthy" : healthScore >= 0.5 ? "degraded" : "unhealthy",
          healthScore,
          responseTime,
          timestamp: new Date().toISOString()
        },
        knowledgeBase: knowledgeStats ? {
          available: true,
          totalEntries: knowledgeStats.total_knowledge_entries,
          qualityScore: knowledgeStats.knowledge_quality_score,
          lastUpdated: knowledgeStats.last_updated,
          avgEmbeddingDimension: knowledgeStats.avg_embedding_dimension,
          coverageByCategory: knowledgeStats.coverage_by_category
        } : {
          available: false,
          error: "Knowledge base statistics not available"
        },
        databaseFunctions: functionTests,
        errorHandling: {
          circuitBreakerEnabled: true,
          failureStats: errorStats,
          strategies: Object.keys(errorStats).map(strategy => ({
            name: strategy,
            failureCount: errorStats[strategy].failureCount,
            circuitBreakerOpen: errorStats[strategy].circuitBreakerOpen,
            lastFailureTime: errorStats[strategy].lastFailureTime,
            status: errorStats[strategy].circuitBreakerOpen ? "circuit_open" : 
                   errorStats[strategy].failureCount > 0 ? "degraded" : "healthy"
          }))
        },
        recommendations: {
          ragEnhanced: {
            available: functionTests.ragEnhanced.available,
            recommended: healthScore >= 0.7 && knowledgeStats?.knowledge_quality_score >= 0.5
          },
          adaptive: {
            available: functionTests.adaptive.available,
            recommended: healthScore >= 0.6
          },
          fallbackChain: [
            "rag_enhanced",
            "adaptive", 
            "hybrid",
            "vector",
            "keyword"
          ]
        }
      },
      metadata: {
        version: "2.0",
        algorithm: "2-stage-rag-enhanced-search-then-rerank",
        capabilities: [
          "rag_enhanced_search",
          "adaptive_query_processing", 
          "circuit_breaker_protection",
          "intelligent_fallback",
          "confidence_scoring",
          "health_monitoring"
        ]
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
        type: "system_status_error"
      },
      data: {
        system: {
          status: "error",
          healthScore: 0,
          timestamp: new Date().toISOString()
        }
      }
    }, { status: 500 });
  }
}

/**
 * POST /api/system/rag-status
 * Reset circuit breakers and clear error statistics
 */
export async function POST() {
  try {
    // Reset all circuit breakers
    const strategies = ["rag_enhanced", "adaptive", "hybrid", "vector", "keyword"];
    for (const strategy of strategies) {
      ragErrorHandler.resetCircuitBreaker(strategy as any);
    }

    return NextResponse.json({
      success: true,
      message: "Circuit breakers reset successfully",
      data: {
        resettedStrategies: strategies,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
        type: "circuit_breaker_reset_error"
      }
    }, { status: 500 });
  }
}

async function testDatabaseFunctions() {
  const results = {
    ragEnhanced: { available: false, error: null as string | null },
    adaptive: { available: false, error: null as string | null },
    knowledgeStats: { available: false, error: null as string | null }
  };

  // Test rag_enhanced_tool_search function
  try {
    await supabase.rpc('rag_enhanced_tool_search', {
      query_text: 'test',
      query_embedding: '[0,0,0]',
      match_count: 1,
      knowledge_weight: 0.4,
      context_weight: 0.35,
      semantic_weight: 0.25
    });
    results.ragEnhanced.available = true;
  } catch (error) {
    results.ragEnhanced.error = error instanceof Error ? error.message : String(error);
  }

  // Test adaptive_tool_search function
  try {
    await supabase.rpc('adaptive_tool_search', {
      query_text: 'test',
      query_embedding: '[0,0,0]',
      match_count: 1,
      query_type: 'general',
      knowledge_weight: 0.35,
      context_weight: 0.35,
      semantic_weight: 0.3
    });
    results.adaptive.available = true;
  } catch (error) {
    results.adaptive.error = error instanceof Error ? error.message : String(error);
  }

  // Test rag_knowledge_stats function
  try {
    await supabase.rpc('rag_knowledge_stats');
    results.knowledgeStats.available = true;
  } catch (error) {
    results.knowledgeStats.error = error instanceof Error ? error.message : String(error);
  }

  return results;
}

function calculateHealthScore({
  errorStats,
  knowledgeStats,
  functionTests
}: {
  errorStats: any;
  knowledgeStats: any;
  functionTests: any;
}): number {
  let score = 0;
  let totalWeights = 0;

  // Knowledge base health (30% weight)
  if (knowledgeStats) {
    const knowledgeHealth = Math.min(1, knowledgeStats.knowledge_quality_score);
    score += knowledgeHealth * 0.3;
    totalWeights += 0.3;
  }

  // Database functions availability (40% weight)
  const availableFunctions = Object.values(functionTests)
    .filter((test: any) => test.available).length;
  const totalFunctions = Object.values(functionTests).length;
  const functionHealth = totalFunctions > 0 ? availableFunctions / totalFunctions : 0;
  score += functionHealth * 0.4;
  totalWeights += 0.4;

  // Circuit breaker status (30% weight)
  const strategies = Object.values(errorStats);
  const healthyStrategies = strategies.filter((stat: any) => !stat.circuitBreakerOpen).length;
  const circuitHealth = strategies.length > 0 ? healthyStrategies / strategies.length : 1;
  score += circuitHealth * 0.3;
  totalWeights += 0.3;

  return totalWeights > 0 ? score / totalWeights : 0;
}