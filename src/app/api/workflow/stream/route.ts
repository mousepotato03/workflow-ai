import { NextRequest } from "next/server";
import { z } from "zod";
import { createTaskDecomposerChain } from "@/lib/langchain/chains";
import { WorkflowRequest } from "@/types/workflow";
import { logger, extractUserContext } from "@/lib/logger/structured-logger";
import { getEnvVar } from "@/lib/config/env-validation";
import {
  processTasksInParallel,
  batchSaveRecommendations,
  getUserPreferences,
} from "@/lib/services/workflow-service";
import {
  createManagedStream,
  SSE_HEADERS,
  ManagedReadableStream,
} from "@/lib/services/stream-service";
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

// Stateless streaming endpoint (no workflows/tasks persistence)

// Server-Sent Events stream for real-time workflow processing
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

  const userContext = extractUserContext(request);
  const workflowId = crypto.randomUUID();

  // Create managed stream with proper resource handling
  const managedStream = createManagedStream(workflowId, userContext);

  // Start background processing
  processWorkflow(managedStream, request).catch((error) => {
    managedStream.sendError("Processing failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  });

  // Return the stream response
  return new Response(managedStream.createStream(), {
    headers: SSE_HEADERS,
  });
}

// Background workflow processing function
async function processWorkflow(
  managedStream: ManagedReadableStream,
  request: NextRequest
) {
  const userContext = extractUserContext(request);

  try {
    // Parse and validate request body
    const body: WorkflowRequest = await request.json();
    const validatedData = workflowRequestSchema.parse(body);

    logger.info("Starting streaming workflow", {
      ...userContext,
      goal: validatedData.goal.substring(0, 100),
    });

    managedStream.sendProgress("validation", 10, "입력 데이터 검증 완료");

    // Early return if stream is aborted
    if (!managedStream.isActive()) return;

    const workflowId = crypto.randomUUID();
    managedStream.sendProgress("workflow_created", 20, "워크플로우 생성 완료", {
      workflowId,
    });

    // Early return if stream is aborted
    if (!managedStream.isActive()) return;

    // Step 1: Decompose goal into tasks
    managedStream.sendProgress(
      "task_decomposition_start",
      25,
      "작업 분해 시작 중..."
    );

    const taskDecomposer = createTaskDecomposerChain();
    const taskResult = await taskDecomposer.invoke({
      goal: validatedData.goal,
      language: validatedData.language,
    });

    if (!taskResult.tasks || !Array.isArray(taskResult.tasks)) {
      const error =
        "작업 분해 실패: 올바른 형식의 작업 목록을 생성할 수 없습니다.";
      logger.workflowError(workflow.id, new Error(error), userContext);
      managedStream.sendError(error);
      return;
    }

    managedStream.sendProgress(
      "task_decomposition_complete",
      40,
      `${taskResult.tasks.length}개 작업으로 분해 완료`,
      { taskCount: taskResult.tasks.length }
    );

    // Early return if stream is aborted
    if (!managedStream.isActive()) return;

    // Step 2: Save tasks to database
    managedStream.sendProgress("task_saving", 45, "작업 저장 중...");

    const savedTasks = taskResult.tasks.map(
      (taskName: string, index: number) => ({
        id: crypto.randomUUID(),
        name: taskName,
        order_index: index + 1,
      })
    );

    managedStream.sendProgress(
      "task_saving_complete",
      50,
      "작업 목록 준비 완료"
    );

    // Early return if stream is aborted
    if (!managedStream.isActive()) return;

    // Step 3: Get tool recommendations (parallel processing)
    managedStream.sendProgress(
      "recommendations_start",
      55,
      "도구 추천 시작 중..."
    );

    const userPreferences = getUserPreferences(validatedData);
    const taskRecommendations = await processTasksInParallel(
      savedTasks,
      userPreferences,
      userContext,
      workflowId
    );

    // Early return if stream is aborted
    if (!managedStream.isActive()) return;

    managedStream.sendProgress(
      "recommendations_processing",
      75,
      "추천 결과 저장 중..."
    );

    // Batch save recommendations
    await batchSaveRecommendations(
      taskRecommendations,
      userContext,
      workflow.id
    );

    // Early return if stream is aborted
    if (!managedStream.isActive()) return;

    managedStream.sendProgress(
      "recommendations_complete",
      90,
      "도구 추천 완료"
    );

    // Stateless: no DB workflow status update

    // Format final response
    const recommendations = taskRecommendations.map((rec) => ({
      id: rec.taskId,
      name: rec.taskName,
      order: savedTasks.find((t) => t.id === rec.taskId)?.order_index || 0,
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

    const finalResult = {
      workflowId,
      tasks: recommendations.sort((a, b) => a.order - b.order),
    };

    // Send completion event
    managedStream.sendComplete(finalResult);

    logger.workflowComplete(workflow.id, userContext);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("Streaming workflow failed", {
      ...userContext,
      error: errorMessage,
    });

    managedStream.sendError("워크플로우 처리 중 오류가 발생했습니다.", {
      error: errorMessage,
    });
  }
}
