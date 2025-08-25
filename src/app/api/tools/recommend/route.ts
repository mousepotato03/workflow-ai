import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getToolRecommendationForTask,
  getUserPreferences,
} from "@/lib/services/workflow-service";

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
      language 
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

    // 모든 추천을 Advanced Hybrid Search 기반의 workflow-service로 통일
    console.log("Using Advanced Hybrid Search recommendation engine", {
      taskName,
      userPreferences: JSON.stringify(userPreferences),
      timestamp: new Date().toISOString()
    });
    
    const recommendation = await getToolRecommendationForTask(
      taskName,
      userPreferences,
      userContext
    );
    
    console.log("Advanced Hybrid Search recommendation result", {
      taskName,
      recommendationResult: JSON.stringify(recommendation),
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(recommendation);
    
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
