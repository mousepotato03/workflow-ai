import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { smartRecommendationEngine } from "@/lib/services/smart-recommendation-service";
import { getUserPreferences } from "@/lib/services/workflow-service";

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
    const { taskName, preferences, language } = requestSchema.parse(body);

    console.log("Request data validation complete", {
      requestId,
      taskName,
      language,
      hasPreferences: !!preferences,
      preferences: preferences ? Object.keys(preferences) : null
    });

    const userPreferences = getUserPreferences({ preferences });
    const userContext = {
      sessionId: crypto.randomUUID(),
      language,
    };

    console.log("User context preparation complete", {
      requestId,
      userContext,
      userPreferences: userPreferences ? Object.keys(userPreferences) : null
    });

    const recommendation = await smartRecommendationEngine.getSmartRecommendation(
      taskName,
      userPreferences,
      userContext
    );

    const processingTime = Date.now() - startTime;

    console.log("Single tool recommendation complete", {
      requestId,
      taskName,
      recommendedTool: recommendation.toolName,
      finalScore: recommendation.finalScore,
      taskType: recommendation.taskType,
      processingTime,
      searchDuration: recommendation.searchDuration,
      rerankingDuration: recommendation.rerankingDuration,
      success: !!recommendation.toolId
    });

    return NextResponse.json({
      success: true,
      data: recommendation,
      metadata: {
        algorithm: "2-stage-search-then-rerank",
        version: "1.0",
        timestamp: new Date().toISOString(),
        processingTime,
        requestId
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
    const { tasks, preferences, language, workflowId } = batchRequestSchema.parse(body);

    console.log("Batch request data validation complete", {
      requestId,
      workflowId,
      totalTasks: tasks.length,
      language,
      hasPreferences: !!preferences,
      taskNames: tasks.map(t => t.name.substring(0, 50))
    });

    const userPreferences = getUserPreferences({ preferences });
    const userContext = {
      sessionId: crypto.randomUUID(),
      language,
    };

    console.log("Starting batch processing", {
      requestId,
      workflowId,
      totalTasks: tasks.length,
      userContext
    });

    const recommendations = await smartRecommendationEngine.processTasksInParallel(
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
      recommendationResults: recommendations.map(r => ({
        taskId: r.taskId,
        taskName: r.taskName.substring(0, 50),
        toolName: r.toolName,
        finalScore: r.finalScore,
        taskType: r.taskType,
        success: !!r.toolId
      }))
    });

    return NextResponse.json({
      success: true,
      data: recommendations,
      metadata: {
        algorithm: "2-stage-search-then-rerank",
        version: "1.0",
        timestamp: new Date().toISOString(),
        totalTasks: tasks.length,
        successfulRecommendations: successfulRecommendations.length,
        averageFinalScore,
        processingTime,
        requestId,
        workflowId
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
      algorithm: "2-stage-search-then-rerank",
      version: "1.0",
      description: "Intelligent recommendation engine using vector search and adaptive quality scoring",
      features: {
        stage1: "Vector-based candidate selection (top 10)",
        stage2: "Adaptive reranking based on task type and quality metrics",
        taskTypes: [
          "coding", "math", "analysis", "general", 
          "design", "writing", "communication"
        ],
        qualityMetrics: [
          "benchmarks (HumanEval, SWE_Bench, MATH, GPQA)",
          "user_rating (G2, Capterra, TrustPilot)",
          "performance_score",
          "reliability_score"
        ],
        scoringFormula: "final_score = (similarity * 0.6) + (quality_score * 0.4)"
      },
      endpoints: {
        single: "POST /api/tools/smart-recommend { taskName, preferences?, language? }",
        batch: "POST /api/tools/smart-recommend { tasks, preferences?, language?, workflowId? }"
      }
    },
    timestamp: new Date().toISOString()
  });
}