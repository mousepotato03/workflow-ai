import { NextRequest } from "next/server";
import { z } from "zod";
import { extractUserContext } from "@/lib/logger/structured-logger";
import {
  processTasksInParallel,
  getUserPreferences,
} from "@/lib/services/workflow-service";
import { withAuth, createAuthErrorResponse } from "@/lib/middleware/auth";
import {
  withRateLimit,
  workflowRateLimiter,
  createRateLimitResponse,
} from "@/lib/middleware/rate-limiter";

// Request validation schema
const rematchRequestSchema = z.object({
  taskId: z.string().min(1, "Task ID is required"),
  taskName: z.string().min(1, "Task name is required"),
  language: z.string().min(2).max(10),
});

// Single task tool rematch endpoint
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitCheck = withRateLimit(workflowRateLimiter);
  const rateLimitResult = rateLimitCheck(request);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult.resetTime);
  }

  // Apply authentication (optional for now)
  const authCheck = withAuth({ requireAuth: false, allowLocalhost: true });
  const authResult = authCheck(request);
  if (!authResult.authenticated) {
    return createAuthErrorResponse(authResult.reason);
  }

  const baseUserContext = extractUserContext(request);

  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = rematchRequestSchema.parse(body);


    // Create task object for processing
    const task = {
      id: validatedData.taskId,
      name: validatedData.taskName,
      order_index: 1,
    };

    const userPreferences = getUserPreferences({
      goal: validatedData.taskName,
      language: validatedData.language,
    });

    // Create structured user context for task processing
    const structuredUserContext = {
      userId: baseUserContext.requestId,
      sessionId: baseUserContext.requestId || crypto.randomUUID(),
      language: validatedData.language || "en"
    };

    // Process single task
    const taskRecommendations = await processTasksInParallel(
      [task],
      userPreferences,
      structuredUserContext,
      crypto.randomUUID() // Generate temp workflow ID
    );

    if (taskRecommendations.length === 0) {
      return Response.json(
        { 
          error: "Unable to generate tool recommendation." 
        },
        { status: 500 }
      );
    }

    const recommendation = taskRecommendations[0];

    // Format response
    const result = {
      taskId: recommendation.taskId,
      recommendedTool: recommendation.toolId
        ? {
            id: recommendation.toolId,
            name: recommendation.toolName,
            logoUrl: "",
            url: "",
          }
        : null,
      recommendationReason: recommendation.reason,
      confidence: recommendation.confidenceScore,
    };


    return Response.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    

    if (error instanceof z.ZodError) {
      return Response.json(
        { 
          error: "Input data is invalid.",
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return Response.json(
      { 
        error: "An error occurred during tool rematch." 
      },
      { status: 500 }
    );
  }
}