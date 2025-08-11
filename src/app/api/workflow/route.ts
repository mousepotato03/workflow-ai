import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createTaskDecomposerChain } from "@/lib/langchain/chains";
import { WorkflowRequest, WorkflowResponse } from "@/types/workflow";
import { logger, extractUserContext } from "@/lib/logger/structured-logger";
import { workflowCache, CacheUtils } from "@/lib/cache/memory-cache";
import {
  processTasksInParallel,
  batchSaveRecommendations,
  getUserPreferences,
} from "@/lib/services/workflow-service";
import { withAuth, createAuthErrorResponse } from "@/lib/middleware/auth";
import {
  withRateLimit,
  workflowRateLimiter,
  createRateLimitResponse,
} from "@/lib/middleware/rate-limiter";

// Request validation schema
const workflowRequestSchema = z.object({
  goal: z
    .string()
    .min(10, "목표는 10자 이상 입력해주세요.")
    .max(200, "목표는 200자 이내로 입력해주세요."),
  language: z.string().min(2).max(10),
});

// Note: This endpoint now runs statelessly without persisting workflows/tasks

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

  const startTime = Date.now();
  const baseContext = extractUserContext(request);
  const userContext = {
    ...baseContext,
    sessionId: baseContext.requestId || crypto.randomUUID(),
    language: "ko", // Will be updated after validation
    requestId: baseContext.requestId || crypto.randomUUID(),
  };
  const workflowId = crypto.randomUUID();

  logger.apiRequest("POST", "/api/workflow", 0, 0, userContext);
  logger.workflowStart(workflowId, "", userContext);

  try {
    // Parse and validate request body
    const body: WorkflowRequest = await request.json();
    const validatedData = workflowRequestSchema.parse(body);

    // Update userContext with validated language
    userContext.language = validatedData.language;

    logger.info("Workflow request validated", {
      ...userContext,
      workflowId,
      goal: validatedData.goal.substring(0, 100), // Truncate for logging
      language: validatedData.language,
    });

    // Check cache for similar workflow requests
    const cacheKey = CacheUtils.generateKey({
      goal: validatedData.goal.toLowerCase().trim(),
      language: validatedData.language,
    });

    const cachedResult = workflowCache.get(cacheKey);
    if (cachedResult) {
      logger.cacheHit("workflow", cacheKey, userContext);

      const duration = Date.now() - startTime;
      logger.apiRequest("POST", "/api/workflow", duration, 200, userContext);

      return NextResponse.json({
        ...cachedResult,
        workflowId: workflowId, // Use new ID for tracking
        fromCache: true,
      });
    }

    logger.cacheMiss("workflow", cacheKey, userContext);

    // Stateless: no DB workflow record created

    // Step 1: Decompose goal into tasks using LangChain
    logger.info("Starting task decomposition", { ...userContext, workflowId });
    const taskDecomposer = createTaskDecomposerChain();
    const taskResult = await taskDecomposer.invoke({
      goal: validatedData.goal,
      language: validatedData.language,
    });

    if (!taskResult.tasks || !Array.isArray(taskResult.tasks)) {
      const error = new Error(
        "작업 분해 실패: 올바른 형식의 작업 목록을 생성할 수 없습니다."
      );
      logger.workflowError(workflowId, error, {
        ...userContext,
        stage: "task_decomposition",
      });
      throw error;
    }

    logger.info("Task decomposition completed", {
      ...userContext,
      workflowId,
      taskCount: taskResult.tasks.length,
      tasks: taskResult.tasks,
    });

    // Insert tasks into database
    // Stateless: build tasks in-memory
    const tasks = taskResult.tasks.map((taskName: string, index: number) => ({
      id: crypto.randomUUID(),
      name: taskName,
      order_index: index + 1,
    }));

    // Step 2: Get tool recommendations for each task (optimized with parallel processing)
    logger.info("Starting tool recommendations", {
      ...userContext,
      workflowId,
      taskCount: tasks.length,
    });

    const userPreferences = getUserPreferences(validatedData);
    const taskRecommendations = await processTasksInParallel(
      tasks.map((task) => ({ id: task.id, name: task.name })),
      userPreferences,
      userContext,
      workflowId
    );

    // Batch save recommendations
    await batchSaveRecommendations(
      taskRecommendations,
      userContext,
      workflowId
    );

    // Format recommendations for response
    const recommendations = taskRecommendations.map((rec) => ({
      id: rec.taskId,
      name: rec.taskName,
      order: tasks.find((t) => t.id === rec.taskId)?.order_index || 0,
      recommendedTool: rec.toolId
        ? {
            id: rec.toolId,
            name: rec.toolName,
            logoUrl: "",
            url: "",
          }
        : null,
      recommendationReason: rec.reason,
      confidence: rec.confidenceScore,
    }));

    // Stateless: no DB status update

    // Return response
    const response: WorkflowResponse = {
      workflowId: workflowId,
      tasks: recommendations.sort((a, b) => a.order - b.order),
      status: "completed",
    };

    // Cache the successful result
    workflowCache.set(cacheKey, response);

    const duration = Date.now() - startTime;
    logger.workflowComplete(
      workflowId,
      duration,
      recommendations.length,
      userContext
    );
    logger.apiRequest("POST", "/api/workflow", duration, 200, userContext);

    return NextResponse.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof z.ZodError) {
      logger.warn("Validation error in workflow API", {
        ...userContext,
        workflowId,
        validationErrors: error.errors,
      });

      logger.apiRequest("POST", "/api/workflow", duration, 400, userContext);

      return NextResponse.json(
        {
          error: "입력 데이터가 올바르지 않습니다.",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Log the error with full context
    logger.apiError(
      "POST",
      "/api/workflow",
      error instanceof Error ? error : new Error(String(error)),
      { ...userContext, workflowId }
    );

    logger.apiRequest("POST", "/api/workflow", duration, 500, userContext);

    // Return user-friendly error message
    const userMessage =
      error instanceof Error && error.message.includes("워크플로우")
        ? error.message
        : "서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";

    return NextResponse.json(
      {
        error: userMessage,
        timestamp: new Date().toISOString(),
        requestId: userContext.requestId,
      },
      { status: 500 }
    );
  }
}
