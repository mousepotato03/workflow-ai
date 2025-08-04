import { createClient } from "@supabase/supabase-js";
import { getEnvVar } from "@/lib/config/env-validation";
import { getRelevantTools } from "@/lib/supabase/vector-store";
import { createToolRecommenderChain, formatToolsContext, parseToolRecommendation } from "@/lib/langchain/chains";
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

/**
 * Process multiple tasks in parallel for tool recommendations
 * Resolves N+1 query problem by batching operations
 */
export async function processTasksInParallel(
  tasks: Array<{ id: string; name: string }>,
  userPreferences: UserPreferences,
  userContext: { userId?: string; sessionId: string; language: string },
  workflowId: string
): Promise<TaskRecommendation[]> {
  const toolRecommender = createToolRecommenderChain();
  
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

      // Get LLM recommendation
      const recommendationStartTime = Date.now();
      const toolsContext = formatToolsContext(relevantTools);
      const recommendation = await toolRecommender.invoke({
        task: task.name,
        context: toolsContext,
        language: userContext.language,
      });

      const recommendationEndTime = Date.now();
      const recommendationDuration = recommendationEndTime - recommendationStartTime;

      const { toolName, reason } = parseToolRecommendation(recommendation);

      // Find the recommended tool in relevant tools
      const recommendedTool = relevantTools.find(
        (tool) => tool.metadata.name === toolName
      );

      const confidenceScore = recommendedTool ? 0.8 : 0.3;

      logger.debug("Task recommendation completed", {
        ...userContext,
        workflowId,
        taskId: task.id,
        recommendedTool: toolName,
        confidenceScore,
        searchDuration,
        recommendationDuration,
      });

      return {
        taskId: task.id,
        taskName: task.name,
        toolId: recommendedTool?.metadata.id || null,
        toolName: toolName,
        reason: reason || "추천된 도구입니다.",
        confidenceScore,
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
    successfulRecommendations: recommendations.filter(r => r.toolId !== null).length,
    totalSearchDuration: recommendations.reduce((sum, r) => sum + r.searchDuration, 0),
    totalRecommendationDuration: recommendations.reduce((sum, r) => sum + r.recommendationDuration, 0),
  });

  return recommendations;
}

/**
 * Batch save recommendations to database
 * More efficient than individual inserts
 */
export async function batchSaveRecommendations(
  recommendations: TaskRecommendation[],
  userContext: { userId?: string; sessionId: string },
  workflowId: string
): Promise<void> {
  try {
    const recommendationsToSave = recommendations.map(rec => ({
      task_id: rec.taskId,
      tool_id: rec.toolId,
      reason: rec.reason,
      confidence_score: rec.confidenceScore,
    }));

    const { error } = await supabase
      .from("recommendations")
      .insert(recommendationsToSave);

    if (error) {
      throw error;
    }

    logger.info("Batch recommendations saved successfully", {
      ...userContext,
      workflowId,
      recommendationsCount: recommendations.length,
    });

  } catch (error) {
    logger.error("Failed to save recommendations", {
      error: error instanceof Error ? error.message : "Unknown error",
      ...userContext,
      workflowId,
      recommendationsCount: recommendations.length,
    });
    throw error;
  }
}

/**
 * Get user preferences with defaults
 */
export function getUserPreferences(requestData?: any): UserPreferences {
  return {
    difficulty_level: requestData?.preferences?.difficulty_level || "intermediate",
    budget_range: requestData?.preferences?.budget_range || "mixed",
    categories: requestData?.preferences?.categories || [],
  };
}