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
    })
    .optional(),
  language: z.string().min(2).max(10).default("ko"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskName, preferences, language } = requestSchema.parse(body);

    const userPreferences = getUserPreferences({ preferences });

    const recommendation = await getToolRecommendationForTask(
      taskName,
      userPreferences,
      {
        sessionId: crypto.randomUUID(),
        language,
      }
    );

    return NextResponse.json(recommendation);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
