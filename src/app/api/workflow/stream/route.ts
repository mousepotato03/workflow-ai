import { NextRequest } from "next/server";
import { z } from "zod";
import { createTaskDecomposerChain } from "@/lib/langchain/chains";
import { WorkflowRequest } from "@/types/workflow";
import { extractUserContext } from "@/lib/logger/structured-logger";
import { getEnvVar } from "@/lib/config/env-validation";
import {
  processTasksInParallel,
  batchSaveRecommendations,
  getUserPreferences,
  processTasksWithGuidesInParallel,
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
    .min(10, "Please enter at least 10 characters.")
    .max(200, "Please keep it under 200 characters."),
  language: z.string().min(2).max(10),
  freeToolsOnly: z.boolean().optional(),
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

  const baseUserContext = extractUserContext(request);
  const workflowId = crypto.randomUUID();

  // Create user context with required fields
  const userContext = {
    userId: baseUserContext.requestId,
    sessionId: baseUserContext.requestId || crypto.randomUUID(),
    language: "en", // Default language, can be extracted from request if needed
  };

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
  const baseUserContext = extractUserContext(request);

  try {
    // Parse and validate request body
    const body: WorkflowRequest = await request.json();
    const validatedData = workflowRequestSchema.parse(body);


    managedStream.sendProgress("validation", 10, "Input data validation complete");

    // Early return if stream is aborted
    if (!managedStream.isActive()) return;

    const workflowId = crypto.randomUUID();
    managedStream.sendProgress("workflow_created", 20, "Workflow creation complete");

    // Early return if stream is aborted
    if (!managedStream.isActive()) return;

    // Step 1: Decompose goal into tasks
    managedStream.sendProgress(
      "task_decomposition_start",
      25,
      "Starting task decomposition..."
    );

    const taskDecomposer = createTaskDecomposerChain();
    const taskResult = await taskDecomposer.invoke({
      goal: validatedData.goal,
      language: validatedData.language,
    });

    if (!taskResult.tasks || !Array.isArray(taskResult.tasks)) {
      const error =
        "Task decomposition failed: Unable to generate a proper task list.";
      managedStream.sendError(error);
      return;
    }

    managedStream.sendProgress(
      "task_decomposition_complete",
      40,
      `Decomposed into ${taskResult.tasks.length} tasks`
    );

    // Early return if stream is aborted
    if (!managedStream.isActive()) return;

    // Step 2: Save tasks to database
    managedStream.sendProgress("task_saving", 45, "Saving tasks...");

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
      "Task list preparation complete"
    );

    // Early return if stream is aborted
    if (!managedStream.isActive()) return;

    // Step 3: Process tasks in parallel (tools + guides)
    managedStream.sendProgress(
      "parallel_processing_start",
      55,
      "Starting tool recommendation and guide generation..."
    );

    const userPreferences = getUserPreferences(validatedData);

    // Create structured user context for task processing
    const structuredUserContext = {
      userId: baseUserContext.requestId,
      sessionId: baseUserContext.requestId || crypto.randomUUID(),
      language: validatedData.language || "en",
    };

    // Process tasks in parallel with real-time updates
    const taskResults = await processTasksWithGuidesInParallel(
      savedTasks,
      userPreferences,
      structuredUserContext,
      workflowId,
      managedStream
    );

    // Early return if stream is aborted
    if (!managedStream.isActive()) return;

    managedStream.sendProgress(
      "parallel_processing_complete",
      90,
      "All tasks processing complete"
    );

    // Stateless: no DB workflow status update

    // Format final response
    const recommendations = taskResults.map((result) => ({
      id: result.taskId,
      name: result.taskName,
      order: savedTasks.find((t) => t.id === result.taskId)?.order_index || 0,
      recommendedTool: result.toolId
        ? {
            id: result.toolId,
            name: result.toolName,
            logoUrl: "",
            url: "",
          }
        : null,
      recommendationReason: result.reason,
      confidence: result.confidenceScore,
      guide: result.guide || null,
    }));

    const finalResult = {
      workflowId,
      tasks: recommendations.sort((a, b) => a.order - b.order),
    };

    // Send completion event
    managedStream.sendComplete(finalResult);

  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    managedStream.sendError("An error occurred while processing the workflow.", {
      error: errorMessage,
    });
  }
}
