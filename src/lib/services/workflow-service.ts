import { createClient } from "@supabase/supabase-js";
import { getEnvVar } from "@/lib/config/env-validation";
import { getRelevantTools } from "@/lib/supabase/vector-store";
import { logger } from "@/lib/logger/structured-logger";
import { guideGenerationService } from "./guide-generation-service";
import type { ManagedReadableStream } from "./stream-service";

// Initialize Supabase client
const supabase = createClient(
  getEnvVar("NEXT_PUBLIC_SUPABASE_URL"),
  getEnvVar("SUPABASE_SERVICE_ROLE_KEY")
);

export interface TaskRecommendation {
  taskId: string;
  taskName: string;
  toolId: string | null;
  toolName: string | null;
  reason: string;
  confidenceScore: number;
  searchDuration: number;
  recommendationDuration: number;
}

export interface TaskWithGuideResult extends TaskRecommendation {
  guide?: {
    id: string;
    summary: string;
    sections: Array<{
      title: string;
      content: string;
      steps?: string[];
    }>;
    sourceUrls: string[];
    confidenceScore: number;
  } | null;
  guideGenerationDuration?: number;
}

export interface UserPreferences {
  categories?: string[];
  difficulty_level?: string;
  budget_range?: string;
  freeToolsOnly?: boolean;
}

interface PolicyWeights {
  bench: number;
  domain: number;
  cost: number;
}

interface ToolMetrics {
  id: string;
  name: string;
  domains: string[] | null;
  scores: {
    user_rating?: { [key: string]: number };
    pricing_model?: string;
    pricing_notes?: string;
    source_urls?: string[];
    last_updated?: string;
  } | null;
  url?: string | null;
  logo_url?: string | null;
}

async function getPolicyWeights(): Promise<PolicyWeights> {
  // DB table removed. Use static defaults.
  return { bench: 0.6, domain: 0.3, cost: 0.1 };
}

function computeDomainMatch(
  query: string,
  domains: string[] | null | undefined
): number {
  const q = query.toLowerCase();
  const isCode =
    q.includes("code") || q.includes("implement") || q.includes("function");
  if (isCode && (domains || []).includes("code")) return 1.0;
  return 0.0;
}

function computeScore(
  query: string,
  tool: ToolMetrics,
  weights: PolicyWeights
): { score: number; bench: number; domain: number; cost: number } {
  // Extract rating from scores (use G2 rating or first available rating)
  const userRating = tool.scores?.user_rating;
  let bench = 0;
  if (userRating) {
    // Use G2 rating if available, otherwise use first available rating
    const rating = userRating['G2'] || Object.values(userRating)[0] || 0;
    bench = rating / 5.0; // Normalize to 0-1 scale (assuming 5-star rating)
  }

  const domain = computeDomainMatch(query, tool.domains ?? []);
  
  // Extract cost from pricing model
  let cost = 0;
  if (tool.scores?.pricing_model) {
    switch (tool.scores.pricing_model.toLowerCase()) {
      case 'free':
        cost = 1.0; // Free is best
        break;
      case 'freemium':
        cost = 0.8; // Freemium is good
        break;
      case 'paid':
        cost = 0.3; // Paid is okay
        break;
      default:
        cost = 0.5; // Unknown, neutral score
    }
  }

  const score = bench * weights.bench + domain * weights.domain + cost * weights.cost;
  return { score, bench, domain, cost };
}

function getFallbackTool(taskName: string): { id: string; name: string } | null {
  const task = taskName.toLowerCase();
  
  // 프레젠테이션 관련
  if (task.includes("presentation") || task.includes("slide") || task.includes("present")) {
    return { id: "google-slides-fallback", name: "Google Slides" };
  }
  
  // 리서치 관련
  if (task.includes("research") || task.includes("gathering") || task.includes("information")) {
    return { id: "google-search-fallback", name: "Google Search" };
  }
  
  // 글쓰기 관련
  if (task.includes("write") || task.includes("script") || task.includes("document")) {
    return { id: "google-docs-fallback", name: "Google Docs" };
  }
  
  // 구조화/계획 관련
  if (task.includes("outline") || task.includes("structure") || task.includes("organize")) {
    return { id: "notion-fallback", name: "Notion" };
  }
  
  // 기본 fallback
  return { id: "chatgpt-fallback", name: "ChatGPT" };
}

/**
 * Process multiple tasks in parallel for tool recommendations
 * Used for guide generation - NOT for workflow creation
 * Resolves N+1 query problem by batching operations
 */
export async function processTasksInParallel(
  tasks: Array<{ id: string; name: string }>,
  userPreferences: UserPreferences,
  userContext: { userId?: string; sessionId: string; language: string },
  workflowId: string
): Promise<TaskRecommendation[]> {
  const weights = await getPolicyWeights();

  // Process all tasks in parallel
  const taskPromises = tasks.map(async (task) => {
    const taskStartTime = Date.now();

    try {
      logger.debug("Processing task for recommendations", {
        ...userContext,
        workflowId,
        taskId: task.id,
        taskName: task.name,
      });

      // Retrieve similar tools using enhanced search
      const relevantTools = await getRelevantTools(
        task.name,
        3,
        userPreferences
      );

      const searchEndTime = Date.now();
      const searchDuration = searchEndTime - taskStartTime;

      logger.searchPerformance(
        "tool_search",
        task.name,
        searchDuration,
        relevantTools.length,
        {
          ...userContext,
          workflowId,
          taskId: task.id,
        }
      );

      console.log("Task processing result:", {
        taskName: task.name,
        relevantToolsFound: relevantTools.length,
        candidateIds: relevantTools.map(t => t.metadata.id),
        candidateNames: relevantTools.map(t => t.metadata.name)
      });

      if (relevantTools.length === 0) {
        console.log("No tools found, using fallback for:", task.name);
        // Fallback: 태스크 타입에 따라 기본 도구 제안
        const fallbackTool = getFallbackTool(task.name);
        
        if (fallbackTool) {
          console.log("Fallback tool selected:", fallbackTool);
          return {
            taskId: task.id,
            taskName: task.name,
            toolId: fallbackTool.id,
            toolName: fallbackTool.name,
            reason: "기본 도구 추천 (벡터 검색 결과 없음)",
            confidenceScore: 0.3,
            searchDuration,
            recommendationDuration: 0,
          };
        }

        return {
          taskId: task.id,
          taskName: task.name,
          toolId: null,
          toolName: null,
          reason: "해당 작업에 적합한 도구를 찾을 수 없습니다.",
          confidenceScore: 0,
          searchDuration,
          recommendationDuration: 0,
        };
      }

      // Minimal policy-based scoring on candidate tools
      const recommendationStartTime = Date.now();
      const candidateIds = relevantTools
        .map((d) => d.metadata.id)
        .filter(Boolean);

      console.log("Starting scoring for task:", {
        taskName: task.name,
        candidateCount: candidateIds.length
      });

      let bestTool: {
        metrics: ToolMetrics;
        score: number;
        bench: number;
        domain: number;
        cost: number;
      } | null = null;

      if (candidateIds.length > 0) {
        console.log("Querying database for tool metrics:", { candidateIds });
        const { data: metricsList, error } = await supabase
          .from("tools")
          .select("id,name,domains,scores,url,logo_url")
          .in("id", candidateIds);

        if (error) {
          console.error("Database query error:", error);
        }

        console.log("Database query result:", {
          taskName: task.name,
          queryCount: candidateIds.length,
          resultCount: metricsList?.length || 0,
          results: metricsList?.map(m => ({
            id: m.id,
            name: m.name,
            domains: m.domains,
            scores: m.scores
          }))
        });

        (metricsList as ToolMetrics[] | null)?.forEach((m) => {
          const scored = computeScore(task.name, m, weights);
          console.log("Tool scoring result:", {
            taskName: task.name,
            toolName: m.name,
            domains: m.domains,
            scores: m.scores,
            calculatedScore: scored.score,
            benchComponent: scored.bench,
            domainComponent: scored.domain,
            costComponent: scored.cost,
            weights
          });
          
          if (!bestTool || scored.score > bestTool.score) {
            console.log("New best tool found:", { 
              toolName: m.name, 
              score: scored.score,
              previousBest: bestTool?.metrics.name || "none"
            });
            bestTool = { metrics: m, ...scored };
          }
        });

        console.log("Final best tool for task:", {
          taskName: task.name,
          bestTool: bestTool ? {
            name: bestTool.metrics.name,
            id: bestTool.metrics.id,
            finalScore: bestTool.score
          } : null
        });
      }

      const recommendationEndTime = Date.now();
      const recommendationDuration =
        recommendationEndTime - recommendationStartTime;

      if (!bestTool) {
        // Fallback: 태스크 타입에 따라 기본 도구 제안
        const fallbackTool = getFallbackTool(task.name);
        
        if (fallbackTool) {
          return {
            taskId: task.id,
            taskName: task.name,
            toolId: fallbackTool.id,
            toolName: fallbackTool.name,
            reason: "기본 도구 추천 (벡터 검색 실패로 인한 fallback)",
            confidenceScore: 0.3, // 낮은 신뢰도
            searchDuration,
            recommendationDuration,
          };
        }
        
        return {
          taskId: task.id,
          taskName: task.name,
          toolId: null,
          toolName: null,
          reason: "해당 작업에 적합한 도구를 찾을 수 없습니다.",
          confidenceScore: 0,
          searchDuration,
          recommendationDuration,
        };
      }

      const reason = `Score ${bestTool.score.toFixed(
        3
      )} (bench ${bestTool.bench.toFixed(2)}*${
        weights.bench
      } + domain ${bestTool.domain.toFixed(2)}*${
        weights.domain
      } + cost ${bestTool.cost.toFixed(2)}*${weights.cost})`;

      logger.debug("Task recommendation completed", {
        ...userContext,
        workflowId,
        taskId: task.id,
        recommendedTool: bestTool.metrics.name,
        confidenceScore: bestTool.score,
        searchDuration,
        recommendationDuration,
      });

      return {
        taskId: task.id,
        taskName: task.name,
        toolId: bestTool.metrics.id,
        toolName: bestTool.metrics.name,
        reason,
        confidenceScore: Math.max(0, Math.min(1, bestTool.score)),
        searchDuration,
        recommendationDuration,
      };
    } catch (error) {
      logger.error("Task recommendation failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        ...userContext,
        workflowId,
        taskId: task.id,
      });

      return {
        taskId: task.id,
        taskName: task.name,
        toolId: null,
        toolName: null,
        reason: "추천 과정에서 오류가 발생했습니다.",
        confidenceScore: 0,
        searchDuration: Date.now() - taskStartTime,
        recommendationDuration: 0,
      };
    }
  });

  // Wait for all tasks to complete
  const recommendations = await Promise.all(taskPromises);

  logger.info("All task recommendations completed", {
    ...userContext,
    workflowId,
    totalTasks: tasks.length,
    successfulRecommendations: recommendations.filter((r) => r.toolId !== null)
      .length,
    totalSearchDuration: recommendations.reduce(
      (sum, r) => sum + r.searchDuration,
      0
    ),
    totalRecommendationDuration: recommendations.reduce(
      (sum, r) => sum + r.recommendationDuration,
      0
    ),
  });

  return recommendations;
}

/**
 * Batch save recommendations to database
 * Used for guide generation - NOT for workflow creation
 * More efficient than individual inserts
 */
export async function batchSaveRecommendations(
  recommendations: TaskRecommendation[],
  userContext: { userId?: string; sessionId: string },
  workflowId: string
): Promise<void> {
  // Persistence disabled: recommendations table removed.
  logger.info("Recommendations persistence disabled (no-op)", {
    ...userContext,
    workflowId,
    recommendationsCount: recommendations.length,
  });
  return;
}

/**
 * Get tool recommendation for a single task (used in guide generation)
 */
export async function getToolRecommendationForTask(
  taskName: string,
  userPreferences: UserPreferences,
  userContext: { userId?: string; sessionId: string; language: string }
): Promise<TaskRecommendation> {
  const weights = await getPolicyWeights();
  const taskStartTime = Date.now();
  const taskId = crypto.randomUUID();

  try {
    // Retrieve similar tools using enhanced search
    const relevantTools = await getRelevantTools(
      taskName,
      3,
      userPreferences
    );

    const searchEndTime = Date.now();
    const searchDuration = searchEndTime - taskStartTime;

    if (relevantTools.length === 0) {
      // Fallback: 태스크 타입에 따라 기본 도구 제안
      const fallbackTool = getFallbackTool(taskName);
      
      if (fallbackTool) {
        return {
          taskId,
          taskName,
          toolId: fallbackTool.id,
          toolName: fallbackTool.name,
          reason: "기본 도구 추천 (벡터 검색 결과 없음)",
          confidenceScore: 0.3, // 낮은 신뢰도
          searchDuration,
          recommendationDuration: 0,
        };
      }
      
      return {
        taskId,
        taskName,
        toolId: null,
        toolName: null,
        reason: "해당 작업에 적합한 도구를 찾을 수 없습니다.",
        confidenceScore: 0,
        searchDuration,
        recommendationDuration: 0,
      };
    }

    // Minimal policy-based scoring on candidate tools
    const recommendationStartTime = Date.now();
    const candidateIds = relevantTools
      .map((d) => d.metadata.id)
      .filter(Boolean);

    console.log("Processing candidate tools:", {
      candidateCount: candidateIds.length,
      candidateIds: candidateIds,
      relevantTools: relevantTools.map(t => ({ 
        id: t.metadata.id, 
        name: t.metadata.name 
      }))
    });

    let bestTool: {
      metrics: ToolMetrics;
      score: number;
      bench: number;
      domain: number;
      cost: number;
    } | null = null;

    if (candidateIds.length > 0) {
      const { data: metricsList } = await supabase
        .from("tools")
        .select("id,name,domains,scores,url,logo_url")
        .in("id", candidateIds);

      console.log("Retrieved metrics for tools:", {
        queryCount: candidateIds.length,
        resultCount: metricsList?.length || 0,
        metrics: metricsList?.map(m => ({
          id: m.id,
          name: m.name,
          domains: m.domains,
          scores: m.scores
        }))
      });

      (metricsList as ToolMetrics[] | null)?.forEach((m) => {
        const scored = computeScore(taskName, m, weights);
        console.log("Tool score calculated:", {
          toolName: m.name,
          toolId: m.id,
          score: scored.score,
          bench: scored.bench,
          domain: scored.domain,
          cost: scored.cost,
          isBest: !bestTool || scored.score > bestTool.score
        });
        
        if (!bestTool || scored.score > bestTool.score) {
          bestTool = { metrics: m, ...scored };
        }
      });
    }

    const recommendationEndTime = Date.now();
    const recommendationDuration =
      recommendationEndTime - recommendationStartTime;

    if (!bestTool) {
      return {
        taskId,
        taskName,
        toolId: null,
        toolName: null,
        reason: "해당 작업에 적합한 도구를 찾을 수 없습니다.",
        confidenceScore: 0,
        searchDuration,
        recommendationDuration,
      };
    }

    const reason = `Score ${bestTool.score.toFixed(
      3
    )} (bench ${bestTool.bench.toFixed(2)}*${
      weights.bench
    } + domain ${bestTool.domain.toFixed(2)}*${
      weights.domain
    } + cost ${bestTool.cost.toFixed(2)}*${weights.cost})`;

    return {
      taskId,
      taskName,
      toolId: bestTool.metrics.id,
      toolName: bestTool.metrics.name,
      reason,
      confidenceScore: Math.max(0, Math.min(1, bestTool.score)),
      searchDuration,
      recommendationDuration,
    };
  } catch (error) {
    logger.error("Task recommendation failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      ...userContext,
      taskName,
    });

    return {
      taskId,
      taskName,
      toolId: null,
      toolName: null,
      reason: "추천 과정에서 오류가 발생했습니다.",
      confidenceScore: 0,
      searchDuration: Date.now() - taskStartTime,
      recommendationDuration: 0,
    };
  }
}

/**
 * Get user preferences with defaults
 */
export function getUserPreferences(requestData?: any): UserPreferences {
  return {
    difficulty_level:
      requestData?.preferences?.difficulty_level || "intermediate",
    budget_range: requestData?.preferences?.budget_range || "mixed",
    categories: requestData?.preferences?.categories || [],
    freeToolsOnly: requestData?.freeToolsOnly || false,
  };
}

/**
 * Process tasks with both tool recommendations and guide generation in parallel
 * Each subtask runs independently and sends real-time updates via stream
 */
export async function processTasksWithGuidesInParallel(
  tasks: Array<{ id: string; name: string }>,
  userPreferences: UserPreferences,
  userContext: { userId?: string; sessionId: string; language: string },
  workflowId: string,
  managedStream: ManagedReadableStream
): Promise<TaskWithGuideResult[]> {
  logger.info("Starting parallel task processing with guides", {
    ...userContext,
    workflowId,
    taskCount: tasks.length,
  });

  // Process all tasks in parallel
  const taskPromises = tasks.map(async (task, index) => {
    const taskStartTime = Date.now();
    
    try {
      // Send initial task start event
      managedStream.sendProgress(
        `task_${task.id}_start`,
        55 + (index * 5), // Distribute progress across remaining 35%
        `작업 "${task.name}" 처리 시작...`
      );

      // Step 1: Get tool recommendation
      const recommendation = await getToolRecommendationForTask(
        task.name,
        userPreferences,
        userContext
      );

      // Send tool recommendation complete event
      managedStream.sendProgress(
        `task_${task.id}_tool_complete`,
        55 + (index * 5) + 2,
        `"${task.name}" 도구 추천 완료: ${recommendation.toolName || '없음'}`
      );

      let guide = null;
      let guideGenerationDuration = 0;

      // Step 2: Generate guide only if we have a tool
      if (recommendation.toolId && recommendation.toolName) {
        const guideStartTime = Date.now();
        
        try {
          managedStream.sendProgress(
            `task_${task.id}_guide_start`,
            55 + (index * 5) + 3,
            `"${recommendation.toolName}" 가이드 생성 중...`
          );

          const generatedGuide = await guideGenerationService.generateToolGuide({
            toolName: recommendation.toolName,
            taskContext: task.name,
            language: userContext.language,
            userContext,
          });

          guide = {
            id: generatedGuide.id,
            summary: generatedGuide.summary,
            sections: generatedGuide.sections,
            sourceUrls: generatedGuide.sourceUrls,
            confidenceScore: generatedGuide.confidenceScore,
          };

          guideGenerationDuration = Date.now() - guideStartTime;

          managedStream.sendProgress(
            `task_${task.id}_guide_complete`,
            55 + (index * 5) + 4,
            `"${recommendation.toolName}" 가이드 생성 완료`
          );

          logger.info("Guide generated successfully for task", {
            ...userContext,
            workflowId,
            taskId: task.id,
            toolName: recommendation.toolName,
            guideGenerationDuration,
            confidenceScore: guide.confidenceScore,
          });

        } catch (guideError) {
          guideGenerationDuration = Date.now() - guideStartTime;
          
          logger.error("Guide generation failed for task", {
            ...userContext,
            workflowId,
            taskId: task.id,
            toolName: recommendation.toolName,
            error: guideError instanceof Error ? guideError.message : String(guideError),
            guideGenerationDuration,
          });

          managedStream.sendProgress(
            `task_${task.id}_guide_error`,
            55 + (index * 5) + 4,
            `"${recommendation.toolName}" 가이드 생성 실패`
          );
        }
      }

      // Send task completion event
      managedStream.sendProgress(
        `task_${task.id}_complete`,
        55 + (index * 5) + 5,
        `작업 "${task.name}" 처리 완료`
      );

      const totalDuration = Date.now() - taskStartTime;

      logger.info("Task processing completed", {
        ...userContext,
        workflowId,
        taskId: task.id,
        taskName: task.name,
        toolId: recommendation.toolId,
        toolName: recommendation.toolName,
        hasGuide: !!guide,
        totalDuration,
        guideGenerationDuration,
      });

      return {
        ...recommendation,
        guide,
        guideGenerationDuration,
      };

    } catch (error) {
      const totalDuration = Date.now() - taskStartTime;
      
      logger.error("Task processing failed", {
        ...userContext,
        workflowId,
        taskId: task.id,
        taskName: task.name,
        error: error instanceof Error ? error.message : String(error),
        totalDuration,
      });

      managedStream.sendProgress(
        `task_${task.id}_error`,
        55 + (index * 5) + 5,
        `작업 "${task.name}" 처리 실패`
      );

      return {
        taskId: task.id,
        taskName: task.name,
        toolId: null,
        toolName: null,
        reason: "처리 중 오류가 발생했습니다.",
        confidenceScore: 0,
        searchDuration: 0,
        recommendationDuration: 0,
        guide: null,
        guideGenerationDuration: totalDuration,
      };
    }
  });

  // Wait for all tasks to complete
  const results = await Promise.all(taskPromises);

  logger.info("All parallel task processing completed", {
    ...userContext,
    workflowId,
    totalTasks: tasks.length,
    successfulRecommendations: results.filter((r) => r.toolId !== null).length,
    successfulGuides: results.filter((r) => r.guide !== null).length,
    totalProcessingTime: results.reduce(
      (sum, r) => sum + (r.guideGenerationDuration || 0) + r.searchDuration + r.recommendationDuration,
      0
    ),
  });

  return results;
}
