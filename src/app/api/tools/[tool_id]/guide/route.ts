import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getEnvVar } from "@/lib/config/env-validation";
import { guideGenerationService } from "@/lib/services/guide-generation-service";
import { logger, extractUserContext } from "@/lib/logger/structured-logger";
import { withAuth, createAuthErrorResponse } from "@/lib/middleware/auth";
import {
  withRateLimit,
  createRateLimitResponse,
} from "@/lib/middleware/rate-limiter";

// Initialize Supabase client with service role for database operations
const supabase = createClient(
  getEnvVar("NEXT_PUBLIC_SUPABASE_URL"),
  getEnvVar("SUPABASE_SERVICE_ROLE_KEY")
);

// Request validation schema
const guideRequestSchema = z.object({
  taskContext: z
    .string()
    .min(3, "작업 맥락은 3자 이상 입력해주세요.")
    .max(200, "작업 맥락은 200자 이내로 입력해주세요."),
  language: z.string().min(2).max(5).default("ko"),
  forceRefresh: z.boolean().default(false),
});

// Rate limiter for guide generation (more restrictive due to AI usage)
const guideRateLimiter = new Map<
  string,
  { count: number; resetTime: number }
>();
const GUIDE_RATE_LIMIT = 5; // 5 requests per hour
const GUIDE_RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function checkGuideRateLimit(ip: string): {
  allowed: boolean;
  resetTime?: number;
} {
  const now = Date.now();
  const userLimit = guideRateLimiter.get(ip);

  if (!userLimit || now > userLimit.resetTime) {
    guideRateLimiter.set(ip, { count: 1, resetTime: now + GUIDE_RATE_WINDOW });
    return { allowed: true };
  }

  if (userLimit.count >= GUIDE_RATE_LIMIT) {
    return { allowed: false, resetTime: userLimit.resetTime };
  }

  userLimit.count += 1;
  return { allowed: true };
}

/**
 * GET /api/tools/[tool_id]/guide
 * Retrieve cached guide or return 404 if not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool_id: string }> }
) {
  const { tool_id } = await params;
  const userContext = extractUserContext(request);

  // Extract query parameters
  const url = new URL(request.url);
  const taskContext = url.searchParams.get("taskContext");
  const language = url.searchParams.get("language") || "ko";

  logger.apiRequest("GET", `/api/tools/${tool_id}/guide`, 0, 0, userContext);

  try {
    if (!taskContext) {
      return NextResponse.json(
        { error: "taskContext query parameter is required" },
        { status: 400 }
      );
    }

    // Look for existing guide in database
    const { data: existingGuide, error } = await supabase
      .from("tool_guides")
      .select(
        `
        id,
        tool_id,
        task_context,
        guide_content,
        source_urls,
        confidence_score,
        language,
        created_at,
        expires_at
      `
      )
      .eq("tool_id", tool_id)
      .eq("task_context", taskContext)
      .eq("language", language)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found"
      logger.error("Database error retrieving guide", {
        ...userContext,
        tool_id,
        taskContext,
        error: error.message,
      });

      return NextResponse.json(
        { error: "데이터베이스 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    if (!existingGuide) {
      return NextResponse.json(
        {
          error: "Guide not found",
          message:
            "해당 조건의 가이드를 찾을 수 없습니다. POST 요청으로 새 가이드를 생성해주세요.",
        },
        { status: 404 }
      );
    }

    logger.info("Retrieved cached guide", {
      ...userContext,
      tool_id,
      taskContext,
      guideId: existingGuide.id,
      confidenceScore: existingGuide.confidence_score,
    });

    const duration = Date.now();
    logger.apiRequest(
      "GET",
      `/api/tools/${tool_id}/guide`,
      duration,
      200,
      userContext
    );

    return NextResponse.json({
      id: existingGuide.id,
      toolId: existingGuide.tool_id,
      taskContext: existingGuide.task_context,
      guide: existingGuide.guide_content,
      sourceUrls: existingGuide.source_urls || [],
      confidenceScore: existingGuide.confidence_score,
      language: existingGuide.language,
      createdAt: existingGuide.created_at,
      expiresAt: existingGuide.expires_at,
      fromCache: true,
    });
  } catch (error) {
    const duration = Date.now();
    logger.apiError(
      "GET",
      `/api/tools/${tool_id}/guide`,
      error instanceof Error ? error : new Error(String(error)),
      { ...userContext, tool_id, taskContext }
    );
    logger.apiRequest(
      "GET",
      `/api/tools/${tool_id}/guide`,
      duration,
      500,
      userContext
    );

    return NextResponse.json(
      { error: "서버에 일시적인 문제가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tools/[tool_id]/guide
 * Generate new guide for the specified tool and task context
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tool_id: string }> }
) {
  const startTime = Date.now();
  const { tool_id } = await params;
  const userContext = extractUserContext(request);

  logger.info("=== GUIDE GENERATION REQUEST START ===", {
    ...userContext,
    tool_id,
    timestamp: new Date().toISOString(),
    requestUrl: request.url
  });

  // Apply rate limiting (more strict for guide generation)
  const ip =
    (request as any).ip || request.headers.get("x-forwarded-for") || "unknown";
  const rateLimitCheck = checkGuideRateLimit(ip);
  if (!rateLimitCheck.allowed) {
    logger.warn("Rate limit exceeded for guide generation", {
      ...userContext,
      tool_id,
      ip,
      resetTime: rateLimitCheck.resetTime
    });
    return createRateLimitResponse(rateLimitCheck.resetTime);
  }

  // Apply authentication (optional but logged)
  const authCheck = withAuth({ requireAuth: false, allowLocalhost: true });
  const authResult = authCheck(request);
  if (!authResult.authenticated) {
    logger.warn("Unauthenticated guide generation request", {
      ...userContext,
      tool_id,
      authReason: authResult.reason
    });
  }

  logger.apiRequest("POST", `/api/tools/${tool_id}/guide`, 0, 0, userContext);

  try {
    // Parse and validate request body
    const body = await request.json();
    
    logger.info("Request body received", {
      ...userContext,
      tool_id,
      body: JSON.stringify(body)
    });
    
    const validatedData = guideRequestSchema.parse(body);

    logger.info("Guide generation request validated", {
      ...userContext,
      tool_id,
      taskContext: validatedData.taskContext,
      language: validatedData.language,
      forceRefresh: validatedData.forceRefresh,
    });

    // Get tool information from database
    logger.info("Querying tool from database", {
      ...userContext,
      tool_id,
      query: "SELECT id, name, description, url, logo_url FROM tools WHERE id = ? AND is_active = true"
    });
    
    const { data: tool, error: toolError } = await supabase
      .from("tools")
      .select("id, name, description, url, logo_url")
      .eq("id", tool_id)
      .eq("is_active", true)
      .single();

    if (toolError || !tool) {
      logger.error("Tool not found for guide generation", {
        ...userContext,
        tool_id,
        error: toolError?.message,
        errorCode: toolError?.code,
        toolQueryResult: tool
      });

      return NextResponse.json(
        { error: "도구를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    logger.info("Tool found successfully", {
      ...userContext,
      tool_id,
      toolName: tool.name,
      toolUrl: tool.url
    });

    // Check for existing guide if not forcing refresh
    if (!validatedData.forceRefresh) {
      const { data: existingGuide } = await supabase
        .from("tool_guides")
        .select(
          "id, guide_content, source_urls, confidence_score, created_at, expires_at"
        )
        .eq("tool_id", tool_id)
        .eq("task_context", validatedData.taskContext)
        .eq("language", validatedData.language)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existingGuide) {
        logger.info("Returning existing guide", {
          ...userContext,
          tool_id,
          guideId: existingGuide.id,
          confidenceScore: existingGuide.confidence_score,
        });

        const duration = Date.now() - startTime;
        logger.apiRequest(
          "POST",
          `/api/tools/${tool_id}/guide`,
          duration,
          200,
          userContext
        );

        return NextResponse.json({
          id: existingGuide.id,
          toolId: tool_id,
          toolName: tool.name,
          taskContext: validatedData.taskContext,
          guide: existingGuide.guide_content,
          sourceUrls: existingGuide.source_urls || [],
          confidenceScore: existingGuide.confidence_score,
          language: validatedData.language,
          createdAt: existingGuide.created_at,
          expiresAt: existingGuide.expires_at,
          fromCache: true,
        });
      }
    }

    // Generate new guide
    logger.info("Starting new guide generation", {
      ...userContext,
      tool_id,
      toolName: tool.name,
      taskContext: validatedData.taskContext,
    });

    const guide = await guideGenerationService.generateToolGuide({
      toolName: tool.name,
      toolUrl: tool.url,
      taskContext: validatedData.taskContext,
      language: validatedData.language,
      userContext,
    });

    // Save generated guide to database
    const { data: savedGuide, error: saveError } = await supabase
      .from("tool_guides")
      .insert({
        tool_id: tool_id,
        task_context: validatedData.taskContext,
        guide_content: {
          summary: guide.summary,
          sections: guide.sections,
        },
        source_urls: guide.sourceUrls,
        confidence_score: guide.confidenceScore,
        language: validatedData.language,
        expires_at: guide.expiresAt.toISOString(),
      })
      .select("id")
      .single();

    if (saveError) {
      logger.error("Failed to save generated guide", {
        ...userContext,
        tool_id,
        error: saveError.message,
      });
    } else {
      logger.info("Guide saved to database", {
        ...userContext,
        tool_id,
        guideId: savedGuide.id,
        confidenceScore: guide.confidenceScore,
      });
    }

    const duration = Date.now() - startTime;
    logger.info("Guide generation completed", {
      ...userContext,
      tool_id,
      toolName: tool.name,
      taskContext: validatedData.taskContext,
      confidenceScore: guide.confidenceScore,
      sectionsCount: guide.sections.length,
      duration,
    });

    logger.apiRequest(
      "POST",
      `/api/tools/${tool_id}/guide`,
      duration,
      201,
      userContext
    );

    return NextResponse.json(
      {
        id: guide.id,
        toolId: tool_id,
        toolName: tool.name,
        toolUrl: tool.url,
        toolLogoUrl: tool.logo_url,
        taskContext: validatedData.taskContext,
        guide: {
          summary: guide.summary,
          sections: guide.sections,
        },
        sourceUrls: guide.sourceUrls,
        confidenceScore: guide.confidenceScore,
        language: validatedData.language,
        createdAt: guide.createdAt.toISOString(),
        expiresAt: guide.expiresAt.toISOString(),
        fromCache: false,
      },
      { status: 201 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof z.ZodError) {
      logger.warn("Validation error in guide generation", {
        ...userContext,
        tool_id,
        validationErrors: error.errors,
      });

      logger.apiRequest(
        "POST",
        `/api/tools/${tool_id}/guide`,
        duration,
        400,
        userContext
      );

      return NextResponse.json(
        {
          error: "입력 데이터가 올바르지 않습니다.",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    logger.apiError(
      "POST",
      `/api/tools/${tool_id}/guide`,
      error instanceof Error ? error : new Error(String(error)),
      { ...userContext, tool_id }
    );

    logger.apiRequest(
      "POST",
      `/api/tools/${tool_id}/guide`,
      duration,
      500,
      userContext
    );

    return NextResponse.json(
      {
        error: "가이드 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        timestamp: new Date().toISOString(),
        requestId: userContext.requestId,
      },
      { status: 500 }
    );
  }
}
