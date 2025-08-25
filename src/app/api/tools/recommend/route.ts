import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getToolRecommendationForTask,
  getUserPreferences,
} from "@/lib/services/workflow-service";
import { smartRecommendationEngine } from "@/lib/services/smart-recommendation-service";
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
  useSmartEngine: z.boolean().optional().default(false), // 스마트 엔진 사용 여부
  // RAG-enhanced search options
  enableRAG: z.boolean().optional().default(true), // RAG-enhanced search 사용 여부
  enableAdaptive: z.boolean().optional().default(true), // Adaptive search 사용 여부
  fallbackToLegacy: z.boolean().optional().default(true), // Legacy search로 fallback 허용 여부
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // console.log("=== TOOL RECOMMENDATION REQUEST ===", {
    //   body: JSON.stringify(body),
    //   timestamp: new Date().toISOString()
    // });
    
    const { 
      taskName, 
      preferences, 
      language, 
      useSmartEngine, 
      enableRAG, 
      enableAdaptive, 
      fallbackToLegacy 
    } = requestSchema.parse(body);

    // console.log("Tool recommendation request parsed", {
    //   taskName,
    //   preferences: JSON.stringify(preferences),
    //   language,
    //   useSmartEngine,
    //   ragOptions: {
    //     enableRAG,
    //     enableAdaptive,
    //     fallbackToLegacy
    //   },
    //   timestamp: new Date().toISOString()
    // });

    const userPreferences = getUserPreferences({ preferences });
    const userContext = {
      sessionId: crypto.randomUUID(),
      language,
    };

    let recommendation;
    
    if (useSmartEngine) {
      // RAG-enhanced or legacy smart engine based on configuration
      const ragOptions = {
        enableRAG,
        enableAdaptive,
        fallbackToLegacy
      };

      // Use RAG-enhanced engine if enabled, otherwise fall back to legacy
      if (enableRAG || enableAdaptive) {
        // console.log("Using RAG-enhanced smart engine", {
        //   taskName,
        //   ragOptions,
        //   timestamp: new Date().toISOString()
        // });

        const ragRecommendation = await smartRecommendationEngine.getSmartRecommendationWithRAG(
          taskName,
          userPreferences,
          userContext,
          ragOptions
        );

        // 기존 형식과 호환되도록 변환
        const compatibleRecommendation = {
          taskId: ragRecommendation.taskId,
          taskName: ragRecommendation.taskName,
          toolId: ragRecommendation.toolId,
          toolName: ragRecommendation.toolName,
          reason: ragRecommendation.reason,
          confidenceScore: ragRecommendation.confidenceScore,
          searchDuration: ragRecommendation.searchDuration,
          recommendationDuration: ragRecommendation.rerankingDuration,
          // RAG-enhanced 추가 정보
          smartEngine: {
            finalScore: ragRecommendation.finalScore,
            similarity: ragRecommendation.similarity,
            qualityScore: ragRecommendation.qualityScore,
            taskType: ragRecommendation.taskType,
            searchStrategy: ragRecommendation.searchStrategy,
            algorithm: "2-stage-rag-enhanced-search-then-rerank",
            ragEnabled: enableRAG,
            adaptiveEnabled: enableAdaptive
          }
        };

        // console.log("RAG-enhanced smart engine recommendation result", {
        //   taskName,
        //   searchStrategy: ragRecommendation.searchStrategy,
        //   recommendationResult: JSON.stringify(compatibleRecommendation),
        //   timestamp: new Date().toISOString()
        // });

        return NextResponse.json(compatibleRecommendation);
      } else {
        // Legacy smart engine
        // console.log("Using legacy smart engine", {
        //   taskName,
        //   ragOptions,
        //   timestamp: new Date().toISOString()
        // });

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

        // console.log("Legacy smart engine recommendation result", {
        //   taskName,
        //   recommendationResult: JSON.stringify(compatibleRecommendation),
        //   timestamp: new Date().toISOString()
        // });

        return NextResponse.json(compatibleRecommendation);
      }
    } else {
      // 기존 추천 엔진 사용
      // console.log("Using legacy recommendation engine", {
      //   taskName,
      //   userPreferences: JSON.stringify(userPreferences),
      //   timestamp: new Date().toISOString()
      // });
      
      recommendation = await getToolRecommendationForTask(
        taskName,
        userPreferences,
        userContext
      );
      
      // console.log("Legacy engine recommendation result", {
      //   taskName,
      //   recommendationResult: JSON.stringify(recommendation),
      //   timestamp: new Date().toISOString()
      // });
      
      return NextResponse.json(recommendation);
    }
    
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
