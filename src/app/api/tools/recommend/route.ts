import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getToolRecommendationForTask,
  getUserPreferences,
} from "@/lib/services/workflow-service";
import { smartRecommendationEngine } from "@/lib/services/smart-recommendation-service";

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
  useSmartEngine: z.boolean().optional().default(false), // 스마트 엔진 사용 여부
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log("=== TOOL RECOMMENDATION REQUEST ===", {
      body: JSON.stringify(body),
      timestamp: new Date().toISOString()
    });
    
    const { taskName, preferences, language, useSmartEngine } = requestSchema.parse(body);

    console.log("Tool recommendation request parsed", {
      taskName,
      preferences: JSON.stringify(preferences),
      language,
      useSmartEngine,
      timestamp: new Date().toISOString()
    });

    const userPreferences = getUserPreferences({ preferences });
    const userContext = {
      sessionId: crypto.randomUUID(),
      language,
    };

    let recommendation;
    
    if (useSmartEngine) {
      // 2단계 Search-then-Rerank 스마트 엔진 사용
      recommendation = await smartRecommendationEngine.getSmartRecommendation(
        taskName,
        userPreferences,
        userContext
      );
      
      // 기존 형식과 호환되도록 변환
      const compatibleRecommendation = {
        taskId: recommendation.taskId,
        taskName: recommendation.taskName,
        toolId: recommendation.toolId,
        toolName: recommendation.toolName,
        reason: recommendation.reason,
        confidenceScore: recommendation.confidenceScore,
        searchDuration: recommendation.searchDuration,
        recommendationDuration: recommendation.rerankingDuration,
        // 추가 정보
        smartEngine: {
          finalScore: recommendation.finalScore,
          similarity: recommendation.similarity,
          qualityScore: recommendation.qualityScore,
          taskType: recommendation.taskType,
          algorithm: "2-stage-search-then-rerank"
        }
      };
      
      console.log("Smart engine recommendation result", {
        taskName,
        recommendationResult: JSON.stringify(compatibleRecommendation),
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json(compatibleRecommendation);
    } else {
      // 기존 추천 엔진 사용
      console.log("Using legacy recommendation engine", {
        taskName,
        userPreferences: JSON.stringify(userPreferences),
        timestamp: new Date().toISOString()
      });
      
      recommendation = await getToolRecommendationForTask(
        taskName,
        userPreferences,
        userContext
      );
      
      console.log("Legacy engine recommendation result", {
        taskName,
        recommendationResult: JSON.stringify(recommendation),
        timestamp: new Date().toISOString()
      });
      
      return NextResponse.json(recommendation);
    }
    
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
