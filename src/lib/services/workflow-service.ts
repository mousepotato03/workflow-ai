import { createClient } from "@supabase/supabase-js";
import { getEnvVar } from "@/lib/config/env-validation";
import { getRelevantTools } from "@/lib/supabase/vector-store";
import { logger } from "@/lib/logger/structured-logger";

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

export interface UserPreferences {
  categories?: string[];
  difficulty_level?: string;
  budget_range?: string;
}

interface PolicyWeights {
  bench: number;
  domain: number;
  cost: number;
}

interface ToolMetrics {
  id: string;
  name: string;
  bench_score: number | null;
  domains: string[] | null;
  cost_index: number | null;
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
    q.includes("code") || q.includes("implement") || q.includes("함수");
  if (isCode && (domains || []).includes("code")) return 1.0;
  return 0.0;
}

function computeScore(
  query: string,
  tool: ToolMetrics,
  weights: PolicyWeights
): { score: number; bench: number; domain: number; cost: number } {
  const bench = Number(tool.bench_score ?? 0);
  const domain = computeDomainMatch(query, tool.domains ?? []);
  const cost = Number(tool.cost_index ?? 0);
  const score =
    bench * weights.bench + domain * weights.domain + cost * weights.cost;
  return { score, bench, domain, cost };
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

      if (relevantTools.length === 0) {
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
          .select("id,name,bench_score,domains,cost_index,url,logo_url")
          .in("id", candidateIds);

        (metricsList as ToolMetrics[] | null)?.forEach((m) => {
          const scored = computeScore(task.name, m, weights);
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
        .select("id,name,bench_score,domains,cost_index,url,logo_url")
        .in("id", candidateIds);

      (metricsList as ToolMetrics[] | null)?.forEach((m) => {
        const scored = computeScore(taskName, m, weights);
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
  };
}
