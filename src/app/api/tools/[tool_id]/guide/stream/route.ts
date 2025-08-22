import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getEnvVar } from "@/lib/config/env-validation";
import { guideGenerationService } from "@/lib/services/guide-generation-service";
import { webSearchService } from "@/lib/services/web-search-service";
import { logger, extractUserContext } from "@/lib/logger/structured-logger";
import { withAuth } from "@/lib/middleware/auth";

// Initialize Supabase client
const supabase = createClient(
  getEnvVar("NEXT_PUBLIC_SUPABASE_URL"),
  getEnvVar("SUPABASE_SERVICE_ROLE_KEY")
);

// Request validation schema
const streamGuideRequestSchema = z.object({
  taskContext: z.string().min(3).max(200),
  language: z.string().min(2).max(5).default("en"),
});

/**
 * POST /api/tools/[tool_id]/guide/stream
 * Stream guide generation progress to client in real-time
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tool_id: string }> }
) {
  const { tool_id } = await params;
  const userContext = extractUserContext(request);

  // Apply authentication check
  const authCheck = withAuth({ requireAuth: false, allowLocalhost: true });
  const authResult = authCheck(request);
  if (!authResult.authenticated) {
    logger.warn("Unauthenticated stream guide request", {
      ...userContext,
      tool_id,
    });
  }

  logger.apiRequest(
    "POST",
    `/api/tools/${tool_id}/guide/stream`,
    0,
    0,
    userContext
  );

  try {
    const body = await request.json();
    const validatedData = streamGuideRequestSchema.parse(body);

    // Create a ReadableStream for real-time updates
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (event: string, data: any) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        const sendError = (error: string) => {
          sendEvent("error", { error });
          controller.close();
        };

        const sendComplete = (result: any) => {
          sendEvent("complete", result);
          controller.close();
        };

        try {
          // Step 1: Get tool information
          sendEvent("progress", {
            stage: "tool_lookup",
            message: "Checking tool information...",
            progress: 10,
          });

          const { data: tool, error: toolError } = await supabase
            .from("tools")
            .select("id, name, description, url, logo_url")
            .eq("id", tool_id)
            .eq("is_active", true)
            .single();

          if (toolError || !tool) {
            return sendError("Tool not found.");
          }

          sendEvent("progress", {
            stage: "tool_found",
            message: `Tool information for ${tool.name} confirmed.`,
            progress: 20,
            toolName: tool.name,
          });

          // Step 2: Check for existing guide
          sendEvent("progress", {
            stage: "cache_check",
            message: "Checking for existing guide...",
            progress: 30,
          });

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
            sendEvent("progress", {
              stage: "cache_found",
              message: "Existing guide found.",
              progress: 100,
            });

            return sendComplete({
              id: existingGuide.id,
              toolId: tool_id,
              toolName: tool.name,
              toolUrl: tool.url,
              toolLogoUrl: tool.logo_url,
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

          // Step 3: Web search
          sendEvent("progress", {
            stage: "web_search",
            message: "Searching for latest usage information on the web...",
            progress: 40,
          });

          const searchResult = await webSearchService.searchToolGuides(
            tool.name,
            validatedData.taskContext,
            validatedData.language
          );

          sendEvent("progress", {
            stage: "search_complete",
            message: `Found ${searchResult.results.length} reference materials.`,
            progress: 60,
            sourceCount: searchResult.results.length,
            isFallback: searchResult.isFallback,
          });

          // Step 4: Generate guide
          sendEvent("progress", {
            stage: "guide_generation",
            message: "AI is generating a personalized guide...",
            progress: 70,
          });

          const guide = await guideGenerationService.generateToolGuide({
            toolName: tool.name,
            toolUrl: tool.url,
            taskContext: validatedData.taskContext,
            language: validatedData.language,
            userContext,
          });

          sendEvent("progress", {
            stage: "guide_ready",
            message: "Guide generation completed.",
            progress: 90,
          });

          // Step 5: Complete (save to database in background)
          sendEvent("progress", {
            stage: "complete",
            message: "Guide is ready!",
            progress: 100,
          });

          // Prepare response data first
          const responseData = {
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
            isSearchFallback: searchResult.isFallback,
          };

          // Send complete response immediately
          sendComplete(responseData);

          // Save to database in background (don't block the response)
          setImmediate(async () => {
            try {
              const { error: saveError } = await supabase
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
                });

              if (saveError) {
                logger.error("Failed to save streamed guide in background", {
                  ...userContext,
                  tool_id,
                  error: saveError.message,
                });
              } else {
                logger.info("Guide saved to database in background", {
                  ...userContext,
                  tool_id,
                  guideId: guide.id,
                  confidenceScore: guide.confidenceScore,
                });
              }
            } catch (backgroundError) {
              logger.error("Background save failed", {
                ...userContext,
                tool_id,
                error:
                  backgroundError instanceof Error
                    ? backgroundError.message
                    : String(backgroundError),
              });
            }
          });
        } catch (error) {
          logger.error("Stream guide generation failed", {
            ...userContext,
            tool_id,
            error: error instanceof Error ? error.message : String(error),
          });

          sendError(
            error instanceof Error
              ? error.message
              : "An error occurred while generating the guide."
          );
        }
      },

      cancel() {
        logger.info("Stream guide generation cancelled by client", {
          ...userContext,
          tool_id,
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Validation error in stream guide generation", {
        ...userContext,
        tool_id,
        validationErrors: error.errors,
      });

      return new Response(
        JSON.stringify({
          error: "Input data is invalid.",
          details: error.errors,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    logger.apiError(
      "POST",
      `/api/tools/${tool_id}/guide/stream`,
      error instanceof Error ? error : new Error(String(error)),
      { ...userContext, tool_id }
    );

    return new Response(
      JSON.stringify({
        error: "An error occurred during stream generation.",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
