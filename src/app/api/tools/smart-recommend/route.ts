import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { smartRecommendationEngine } from "@/lib/services/smart-recommendation-service";
import { getUserPreferences } from "@/lib/services/workflow-service";
import { SearchStrategy } from "@/types/rag-search";

const requestSchema = z.object({
  taskName: z.string().min(1, "taskName is required"),
  preferences: z
    .object({
      categories: z.array(z.string()).optional(),
      difficulty_level: z.string().optional(),
      budget_range: z.string().optional(),
      freeToolsOnly: z.boolean().optional(),
    })
    .optional(),
  language: z.string().min(2).max(10).default("en"),
  // RAG-enhanced search options
  enableRAG: z.boolean().optional().default(true),
  enableAdaptive: z.boolean().optional().default(true),
  fallbackToLegacy: z.boolean().optional().default(true),
});

const batchRequestSchema = z.object({
  tasks: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1)
  })).min(1, "At least one task is required"),
  preferences: z
    .object({
      categories: z.array(z.string()).optional(),
      difficulty_level: z.string().optional(),
      budget_range: z.string().optional(),
      freeToolsOnly: z.boolean().optional(),
    })
    .optional(),
  language: z.string().min(2).max(10).default("en"),
  workflowId: z.string().optional(),
  // RAG-enhanced search options
  enableRAG: z.boolean().optional().default(true),
  enableAdaptive: z.boolean().optional().default(true),
  fallbackToLegacy: z.boolean().optional().default(true),
});

/**
 * POST /api/tools/smart-recommend
 * Single task recommendation using 2-stage Search-then-Rerank engine
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Check if this is a batch processing request
    if (Array.isArray(body.tasks)) {
      return await handleBatchRecommendation(body);
    }
    
    // Single task processing
    return await handleSingleRecommendation(body);
    
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors }, 
        { status: 400 }
      );
    }
    
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function handleSingleRecommendation(body: any) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  console.log("Starting single tool recommendation request", {
    requestId,
    body: { ...body, taskName: body.taskName?.substring(0, 100) },
    timestamp: new Date().toISOString()
  });

  try {
    const { taskName, preferences, language, enableRAG, enableAdaptive, fallbackToLegacy } = requestSchema.parse(body);

    console.log("Request data validation complete", {
      requestId,
      taskName,
      language,
      hasPreferences: !!preferences,
      preferences: preferences ? Object.keys(preferences) : null,
      ragOptions: { enableRAG, enableAdaptive, fallbackToLegacy }
    });

    const userPreferences = getUserPreferences({ preferences });
    const userContext = {
      sessionId: crypto.randomUUID(),
      language,
    };

    const ragOptions = {
      enableRAG,
      enableAdaptive,
      fallbackToLegacy
    };

    console.log("User context preparation complete", {
      requestId,
      userContext,
      userPreferences: userPreferences ? Object.keys(userPreferences) : null,
      ragOptions
    });

    // Use RAG-enhanced recommendation if enabled, otherwise fall back to legacy
    const recommendation = (enableRAG || enableAdaptive) ?
      await smartRecommendationEngine.getSmartRecommendationWithRAG(
        taskName,
        userPreferences,
        userContext,
        ragOptions
      ) :
      await smartRecommendationEngine.getSmartRecommendation(
        taskName,
        userPreferences,
        userContext
      );

    const processingTime = Date.now() - startTime;

    const searchStrategy = (recommendation as any).searchStrategy;
    const isRagEnhanced = enableRAG || enableAdaptive;

    console.log("Single tool recommendation complete", {
      requestId,
      taskName,
      recommendedTool: recommendation.toolName,
      finalScore: recommendation.finalScore,
      taskType: recommendation.taskType,
      searchStrategy: searchStrategy || "legacy",
      processingTime,
      searchDuration: recommendation.searchDuration,
      rerankingDuration: recommendation.rerankingDuration,
      success: !!recommendation.toolId,
      ragEnhanced: isRagEnhanced
    });

    return NextResponse.json({
      success: true,
      data: recommendation,
      metadata: {
        algorithm: isRagEnhanced ? "2-stage-rag-enhanced-search-then-rerank" : "2-stage-search-then-rerank",
        version: "1.0",
        timestamp: new Date().toISOString(),
        processingTime,
        requestId,
        searchStrategy: searchStrategy || "legacy",
        ragOptions: isRagEnhanced ? ragOptions : undefined
      }
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    console.error("Single tool recommendation failed", {
      requestId,
      error: errorMessage,
      processingTime,
      timestamp: new Date().toISOString()
    });

    throw error;
  }
}

async function handleBatchRecommendation(body: any) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  console.log("Starting batch tool recommendation request", {
    requestId,
    totalTasks: body.tasks?.length || 0,
    workflowId: body.workflowId,
    timestamp: new Date().toISOString()
  });

  try {
    const { tasks, preferences, language, workflowId, enableRAG, enableAdaptive, fallbackToLegacy } = batchRequestSchema.parse(body);

    console.log("Batch request data validation complete", {
      requestId,
      workflowId,
      totalTasks: tasks.length,
      language,
      hasPreferences: !!preferences,
      taskNames: tasks.map(t => t.name.substring(0, 50)),
      ragOptions: { enableRAG, enableAdaptive, fallbackToLegacy }
    });

    const userPreferences = getUserPreferences({ preferences });
    const userContext = {
      sessionId: crypto.randomUUID(),
      language,
    };

    const ragOptions = {
      enableRAG,
      enableAdaptive,
      fallbackToLegacy
    };

    console.log("Starting batch processing", {
      requestId,
      workflowId,
      totalTasks: tasks.length,
      userContext,
      ragOptions
    });

    // Use RAG-enhanced batch processing if enabled, otherwise fall back to legacy
    const recommendations = (enableRAG || enableAdaptive) ?
      await smartRecommendationEngine.processTasksInParallelWithRAG(
        tasks as Array<{ id: string; name: string }>,
        userPreferences,
        userContext,
        workflowId,
        ragOptions
      ) :
      await smartRecommendationEngine.processTasksInParallel(
        tasks as Array<{ id: string; name: string }>,
        userPreferences,
        userContext,
        workflowId
      );

    const processingTime = Date.now() - startTime;
    const successfulRecommendations = recommendations.filter(r => r.toolId !== null);
    const averageFinalScore = successfulRecommendations.length > 0 
      ? successfulRecommendations.reduce((sum, r) => sum + r.finalScore, 0) / successfulRecommendations.length
      : 0;

    const isRagEnhanced = enableRAG || enableAdaptive;
    
    // Extract search strategy statistics for RAG-enhanced results
    const searchStrategies = recommendations
      .map(r => (r as any).searchStrategy)
      .filter(Boolean);
    
    const strategyStats = searchStrategies.reduce((acc, strategy) => {
      acc[strategy] = (acc[strategy] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log("Batch tool recommendation complete", {
      requestId,
      workflowId,
      totalTasks: tasks.length,
      successfulRecommendations: successfulRecommendations.length,
      failedRecommendations: tasks.length - successfulRecommendations.length,
      averageFinalScore,
      processingTime,
      averageSearchDuration: recommendations.reduce((sum, r) => sum + r.searchDuration, 0) / recommendations.length,
      averageRerankingDuration: recommendations.reduce((sum, r) => sum + r.rerankingDuration, 0) / recommendations.length,
      ragEnhanced: isRagEnhanced,
      strategyUsage: isRagEnhanced ? strategyStats : undefined,
      recommendationResults: recommendations.map(r => ({
        taskId: r.taskId,
        taskName: r.taskName.substring(0, 50),
        toolName: r.toolName,
        finalScore: r.finalScore,
        taskType: r.taskType,
        searchStrategy: (r as any).searchStrategy || "legacy",
        success: !!r.toolId
      }))
    });

    return NextResponse.json({
      success: true,
      data: recommendations,
      metadata: {
        algorithm: isRagEnhanced ? "2-stage-rag-enhanced-search-then-rerank" : "2-stage-search-then-rerank",
        version: "1.0",
        timestamp: new Date().toISOString(),
        totalTasks: tasks.length,
        successfulRecommendations: successfulRecommendations.length,
        averageFinalScore,
        processingTime,
        requestId,
        workflowId,
        ragOptions: isRagEnhanced ? ragOptions : undefined,
        strategyUsage: isRagEnhanced ? strategyStats : undefined
      }
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    console.error("Batch tool recommendation failed", {
      requestId,
      workflowId: body.workflowId,
      totalTasks: body.tasks?.length || 0,
      error: errorMessage,
      processingTime,
      timestamp: new Date().toISOString()
    });

    throw error;
  }
}

/**
 * GET /api/tools/smart-recommend
 * Query recommendation engine status and metadata
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      algorithm: "2-stage-rag-enhanced-search-then-rerank",
      version: "2.0",
      description: "Advanced intelligent recommendation engine with RAG-enhanced search, adaptive query processing, and multi-strategy fallback",
      features: {
        stage1: "RAG-enhanced candidate selection with adaptive query type detection",
        stage2: "Adaptive reranking based on task type and quality metrics",
        searchStrategies: [
          "RAG-enhanced search (primary)",
          "Adaptive search with query type detection", 
          "Hybrid vector + text search",
          "Pure vector search",
          "Keyword-based search (fallback)"
        ],
        taskTypes: [
          "coding", "math", "analysis", "general", 
          "design", "writing", "communication"
        ],
        queryTypes: [
          "specific_tool", "functional", "category", "general"
        ],
        qualityMetrics: [
          "benchmarks (HumanEval, SWE_Bench, MATH, GPQA)",
          "user_rating (G2, Capterra, TrustPilot)",
          "performance_score",
          "reliability_score",
          "knowledge_coverage",
          "confidence_score"
        ],
        scoringFormula: "final_score = (similarity * 0.6) + (quality_score * 0.4)",
        ragFeatures: {
          knowledgeEnhanced: "Leverages curated knowledge base for better recommendations",
          adaptiveWeights: "Adjusts scoring weights based on query type",
          contextAlignment: "Evaluates contextual relevance beyond semantic similarity",
          confidenceThresholding: "Uses confidence scores to trigger fallback strategies"
        }
      },
      endpoints: {
        single: "POST /api/tools/smart-recommend { taskName, preferences?, language?, enableRAG?, enableAdaptive?, fallbackToLegacy? }",
        batch: "POST /api/tools/smart-recommend { tasks, preferences?, language?, workflowId?, enableRAG?, enableAdaptive?, fallbackToLegacy? }"
      },
      databaseFunctions: {
        ragEnhanced: "rag_enhanced_tool_search() - Main RAG search with weighted scoring",
        adaptive: "adaptive_tool_search() - Query-type adaptive search",
        knowledgeStats: "rag_knowledge_stats() - Knowledge base statistics"
      }
    },
    timestamp: new Date().toISOString()
  });
}