import { createClient } from "@supabase/supabase-js";
import { getEnvVar } from "@/lib/config/env-validation";
import {
  getRelevantTools,
  advancedHybridSearch,
} from "@/lib/supabase/vector-store";
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
  // Updated weights to prioritize domain matching for better task-tool alignment
  return { 
    domain: 0.5,   // Domain matching is most important (task relevance)
    bench: 0.35,   // Performance/quality within relevant domain
    cost: 0.15     // Pricing consideration (increased from 0.1)
  };
}

function computeDomainMatch(
  query: string,
  domains: string[] | null | undefined
): number {
  if (!domains || domains.length === 0) return 0.0;
  
  const queryLower = query.toLowerCase();
  
  // Primary task type detection - these override domain matching
  const primaryTaskTypes = {
    'research': ['research', 'identify', 'gather', 'find', 'analyze', 'study', 'investigate', 'explore', 'discover'],
    'create': ['create', 'make', 'build', 'generate', 'produce', 'develop', 'design', 'craft'],
    'write': ['write', 'draft', 'compose', 'author', 'blog', 'article', 'content', 'copy'],
    'manage': ['manage', 'organize', 'schedule', 'plan', 'coordinate', 'track', 'monitor'],
    'analyze': ['analyze', 'report', 'dashboard', 'metrics', 'data', 'statistics', 'insights']
  };
  
  // Check if this is primarily a research task
  const researchKeywords = primaryTaskTypes.research;
  const researchMatches = researchKeywords.filter(keyword => queryLower.includes(keyword)).length;
  
  // If it's clearly a research task, prioritize research-capable tools
  if (researchMatches >= 2) {
    const researchCapableDomains = ['General Purpose', 'Education', 'Business Analytics', 'Research'];
    if (domains.some(domain => researchCapableDomains.includes(domain))) {
      console.log("Research task detected - boosting research-capable tool:", {
        query: queryLower.substring(0, 50) + "...",
        domains,
        researchMatches
      });
      return 0.8; // High score for research-capable tools
    }
    // Penalize non-research tools for research tasks
    if (domains.includes('Sales') || domains.includes('Marketing') || domains.includes('CRM')) {
      console.log("Research task detected - penalizing non-research tool:", {
        query: queryLower.substring(0, 50) + "...",
        domains
      });
      return 0.1; // Low score for CRM/Sales/Marketing tools on research tasks
    }
  }
  
  // Content creation task detection
  const writeKeywords = primaryTaskTypes.write;
  const writeMatches = writeKeywords.filter(keyword => queryLower.includes(keyword)).length;
  
  if (writeMatches >= 1) {
    const contentCapableDomains = ['Content Creation', 'Writing', 'General Purpose', 'Education'];
    if (domains.some(domain => contentCapableDomains.includes(domain))) {
      console.log("Writing task detected - boosting content-capable tool:", {
        query: queryLower.substring(0, 50) + "...",
        domains,
        writeMatches
      });
      return 0.7; // High score for content creation tools
    }
  }
  
  // Domain-specific keyword mapping - using actual domain names from database
  const domainKeywords = {
    // Actual domains from database (with variations)
    'Social Media': ['social', 'instagram', 'facebook', 'twitter', 'tiktok', 'youtube', 'reel', 'story', 'post', 'share'],
    'Advertising': ['ad', 'campaign', 'marketing', 'promotion', 'targeting', 'audience', 'conversion', 'roi', 'impression'],
    'Marketing': ['marketing', 'campaign', 'ad', 'social', 'seo', 'analytics', 'promotion', 'audience', 'engagement', 'conversion'],
    'Content Creation': ['content', 'create', 'write', 'copy', 'script', 'article', 'blog', 'creative', 'produce'],
    'Social Media Management': ['manage', 'schedule', 'publish', 'social', 'content', 'calendar', 'analytics'],
    'Video Editing': ['video', 'edit', 'movie', 'film', 'clip', 'montage', 'animation', 'motion', 'render', 'footage'],
    'Entertainment': ['entertainment', 'creative', 'art', 'music', 'game', 'story', 'cinematic', 'visual'],
    'Creative Industries': ['creative', 'design', 'art', 'visual', 'brand', 'aesthetic', 'artistic', 'illustration'],
    'Education': ['education', 'learn', 'teach', 'tutorial', 'guide', 'course', 'training', 'knowledge'],
    'Small Business': ['business', 'startup', 'entrepreneur', 'company', 'brand', 'commerce', 'sales'],
    'Software Development': ['code', 'develop', 'program', 'software', 'app', 'website', 'api', 'debug'],
    'Engineering': ['engineer', 'technical', 'system', 'architecture', 'infrastructure', 'build'],
    'DevOps': ['deploy', 'devops', 'infrastructure', 'ci', 'cd', 'automation', 'monitoring', 'ops'],
    'E-commerce': ['ecommerce', 'shop', 'store', 'retail', 'product', 'sell', 'buy', 'commerce'],
    'Retail': ['retail', 'store', 'shop', 'product', 'inventory', 'sales', 'customer'],
    'Dropshipping': ['dropship', 'fulfillment', 'supplier', 'inventory', 'logistics'],
    'Enterprise Commerce': ['enterprise', 'b2b', 'business', 'corporate', 'scale', 'integration'],
    // Legacy mappings for backward compatibility
    'design': ['design', 'logo', 'graphic', 'visual', 'ui', 'ux', 'mockup', 'prototype', 'banner', 'poster'],
    'video': ['video', 'edit', 'movie', 'film', 'youtube', 'tiktok', 'reel', 'clip', 'animation'],
    'marketing': ['marketing', 'campaign', 'ad', 'social', 'seo', 'analytics', 'promotion'],
    'code': ['code', 'develop', 'program', 'function', 'api', 'debug', 'software', 'app'],
    'data': ['data', 'analysis', 'chart', 'dashboard', 'report', 'database', 'metrics'],
    'content': ['write', 'content', 'blog', 'article', 'copy', 'text', 'script'],
    'productivity': ['document', 'note', 'organize', 'plan', 'task', 'project', 'manage'],
    'communication': ['email', 'message', 'chat', 'meeting', 'collaboration', 'discuss'],
    'finance': ['finance', 'budget', 'cost', 'expense', 'revenue', 'profit', 'invoice'],
    'monitoring': ['monitor', 'track', 'observe', 'log', 'metric', 'alert', 'performance']
  };
  
  let maxScore = 0;
  
  // Check each domain that the tool supports
  for (const domain of domains) {
    const keywords = domainKeywords[domain as keyof typeof domainKeywords];
    if (!keywords) continue;
    
    // Count keyword matches and calculate relevance score
    let matchCount = 0;
    let totalRelevance = 0;
    
    for (const keyword of keywords) {
      if (queryLower.includes(keyword)) {
        matchCount++;
        // Give higher weight to longer, more specific keywords
        const keywordWeight = keyword.length > 5 ? 1.2 : 1.0;
        totalRelevance += keywordWeight;
      }
    }
    
    if (matchCount > 0) {
      // Normalize score based on query length and keyword specificity
      const queryWords = queryLower.split(/\s+/).length;
      const relevanceRatio = totalRelevance / Math.max(queryWords, 3);
      const domainScore = Math.min(1.0, relevanceRatio * 0.8 + (matchCount * 0.2));
      maxScore = Math.max(maxScore, domainScore);
      
      console.log("Domain match found:", {
        domain,
        matchCount,
        totalRelevance,
        queryWords,
        relevanceRatio,
        domainScore,
        query: queryLower.substring(0, 50) + "..."
      });
    }
  }
  
  return maxScore;
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
    const rating = userRating["G2"] || Object.values(userRating)[0] || 0;
    bench = rating / 5.0; // Normalize to 0-1 scale (assuming 5-star rating)
  }

  const domain = computeDomainMatch(query, tool.domains ?? []);

  // Extract cost from pricing model
  let cost = 0;
  if (tool.scores?.pricing_model) {
    switch (tool.scores.pricing_model.toLowerCase()) {
      case "free":
        cost = 1.0; // Free is best
        break;
      case "freemium":
        cost = 0.8; // Freemium is good
        break;
      case "paid":
        cost = 0.3; // Paid is okay
        break;
      default:
        cost = 0.5; // Unknown, neutral score
    }
  }

  const score =
    bench * weights.bench + domain * weights.domain + cost * weights.cost;
  return { score, bench, domain, cost };
}

function detectTaskDomain(taskName: string): string {
  const taskLower = taskName.toLowerCase();
  
  // Simplified domain detection for fallback selection
  const taskPatterns = {
    'video': ['video', 'edit', 'movie', 'film', 'youtube', 'tiktok', 'reel', 'clip', 'animation'],
    'design': ['design', 'logo', 'graphic', 'visual', 'ui', 'ux', 'mockup', 'prototype', 'banner'],
    'marketing': ['marketing', 'campaign', 'ad', 'social', 'seo', 'promotion', 'audience'],
    'code': ['code', 'develop', 'program', 'function', 'api', 'debug', 'software', 'app'],
    'data': ['data', 'analysis', 'chart', 'dashboard', 'report', 'metrics', 'analytics'],
    'content': ['write', 'content', 'blog', 'article', 'copy', 'text', 'script'],
    'productivity': ['document', 'note', 'organize', 'plan', 'task', 'project', 'manage'],
    'presentation': ['presentation', 'slide', 'present', 'pitch', 'demo'],
    'research': ['research', 'gather', 'information', 'study', 'analyze'],
    'communication': ['email', 'message', 'chat', 'meeting', 'collaboration'],
    'monitoring': ['monitor', 'track', 'observe', 'log', 'metric', 'alert', 'performance']
  };
  
  // Find the domain with the most keyword matches
  let bestDomain = 'general';
  let maxMatches = 0;
  
  for (const [domain, keywords] of Object.entries(taskPatterns)) {
    const matches = keywords.filter(keyword => taskLower.includes(keyword)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestDomain = domain;
    }
  }
  
  return bestDomain;
}

function getFallbackTool(
  taskName: string
): { id: string; name: string } | null {
  // Domain-specific fallback tools based on actual tools in our database
  const domainFallbacks: Record<string, { id: string; name: string }> = {
    'video': { id: 'invideo-fallback', name: 'InVideo' },
    'design': { id: 'canva-fallback', name: 'Canva' },
    'marketing': { id: 'hubspot-fallback', name: 'HubSpot' },
    'code': { id: 'github-copilot-fallback', name: 'GitHub Copilot' },
    'data': { id: 'airtable-fallback', name: 'Airtable' },
    'content': { id: 'grammarly-fallback', name: 'Grammarly' },
    'productivity': { id: 'notion-fallback', name: 'Notion AI' },
    'presentation': { id: 'canva-fallback', name: 'Canva' }, // Canva supports presentations
    'research': { id: 'perplexity-fallback', name: 'Perplexity AI' },
    'communication': { id: 'slack-fallback', name: 'Slack' },
    'monitoring': { id: 'datadog-fallback', name: 'Datadog' }
  };
  
  const taskDomain = detectTaskDomain(taskName);
  
  console.log("Fallback tool selection:", {
    taskName,
    detectedDomain: taskDomain,
    selectedFallback: domainFallbacks[taskDomain] || domainFallbacks['general']
  });
  
  return domainFallbacks[taskDomain] || { id: 'chatgpt-fallback', name: 'ChatGPT' };
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

      // Try Advanced Hybrid Search first for better accuracy
      let relevantTools;
      try {
        logger.debug("Attempting Advanced Hybrid Search", {
          taskName: task.name,
        });
        const hybridResults = await advancedHybridSearch(
          task.name,
          3,
          0.8, // traditional_weight
          0.2, // rag_weight
          userPreferences
        );

        if (hybridResults && hybridResults.length > 0) {
          // Convert RagDocument[] to Document[] for compatibility
          relevantTools = hybridResults.map((doc: any) => ({
            ...doc,
            metadata: {
              ...doc.metadata,
              // Add hybrid search score information
              hybrid_score: doc.metadata.final_score,
              traditional_score: doc.metadata.traditional_score,
              rag_score: doc.metadata.rag_score,
            },
          }));

          logger.debug("Advanced Hybrid Search successful", {
            taskName: task.name,
            foundTools: relevantTools.length,
            avgScore:
              relevantTools.reduce(
                (sum: number, tool: any) =>
                  sum + (tool.metadata.final_score || 0),
                0
              ) / relevantTools.length,
          });
        } else {
          throw new Error("No hybrid results");
        }
      } catch (error) {
        logger.debug("Advanced Hybrid Search failed, using legacy search", {
          taskName: task.name,
          error: error instanceof Error ? error.message : String(error),
        });

        // Fallback to legacy search
        relevantTools = await getRelevantTools(task.name, 3, userPreferences);
      }

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
        candidateNames: relevantTools.map(t => t.metadata.name),
        hybridScores: relevantTools.map(t => ({
          name: t.metadata.name,
          finalScore: t.metadata.final_score,
          traditionalScore: t.metadata.traditional_score,
          ragScore: t.metadata.rag_score
        }))
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
        candidateCount: candidateIds.length,
        freeToolsOnly: userPreferences?.freeToolsOnly || false
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
            pricingModel: m.scores?.pricing_model,
            userRating: m.scores?.user_rating
          }))
        });

        (metricsList as ToolMetrics[] | null)?.forEach((m) => {
          // Hard filter for free tools only if requested
          if (userPreferences?.freeToolsOnly && m.scores?.pricing_model !== 'free') {
            console.log("Filtered out non-free tool:", {
              toolName: m.name,
              pricingModel: m.scores?.pricing_model,
              reason: "freeToolsOnly filter applied"
            });
            return; // Skip non-free tools entirely
          }
          
          const scored = computeScore(task.name, m, weights);
          console.log("Tool scoring result:", {
            taskName: task.name,
            toolName: m.name,
            toolDomains: m.domains,
            pricingModel: m.scores?.pricing_model,
            calculatedScore: scored.score,
            benchComponent: scored.bench,
            domainComponent: scored.domain,
            costComponent: scored.cost,
            weights,
            isNewBest: !bestTool || scored.score > bestTool.score
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
            finalScore: bestTool.score,
            pricingModel: bestTool.metrics.scores?.pricing_model
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
    // Try Advanced Hybrid Search first for better accuracy
    let relevantTools;
    try {
      logger.debug("Single task: Attempting Advanced Hybrid Search", {
        taskName,
      });
      const hybridResults = await advancedHybridSearch(
        taskName,
        3,
        0.8, // traditional_weight
        0.2, // rag_weight
        userPreferences
      );

      if (hybridResults && hybridResults.length > 0) {
        // Convert RagDocument[] to Document[] for compatibility
        relevantTools = hybridResults.map((doc: any) => ({
          ...doc,
          metadata: {
            ...doc.metadata,
            // Add hybrid search score information
            hybrid_score: doc.metadata.final_score,
            traditional_score: doc.metadata.traditional_score,
            rag_score: doc.metadata.rag_score,
          },
        }));

        logger.debug("Single task: Advanced Hybrid Search successful", {
          taskName,
          foundTools: relevantTools.length,
          avgScore:
            relevantTools.reduce(
              (sum: number, tool: any) =>
                sum + (tool.metadata.final_score || 0),
              0
            ) / relevantTools.length,
        });
      } else {
        throw new Error("No hybrid results");
      }
    } catch (error) {
      logger.debug(
        "Single task: Advanced Hybrid Search failed, using legacy search",
        {
          taskName,
          error: error instanceof Error ? error.message : String(error),
        }
      );

      // Fallback to legacy search
      relevantTools = await getRelevantTools(taskName, 3, userPreferences);
    }

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

    console.log("Processing candidate tools for single task:", {
      taskName,
      candidateCount: candidateIds.length,
      candidateIds: candidateIds,
      relevantTools: relevantTools.map(t => ({
        id: t.metadata.id,
        name: t.metadata.name,
        finalScore: t.metadata.final_score,
        traditionalScore: t.metadata.traditional_score,
        ragScore: t.metadata.rag_score
      })),
      freeToolsOnly: userPreferences?.freeToolsOnly || false
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

      console.log("Retrieved metrics for single task tools:", {
        taskName,
        queryCount: candidateIds.length,
        resultCount: metricsList?.length || 0,
        metrics: metricsList?.map(m => ({
          id: m.id,
          name: m.name,
          domains: m.domains,
          pricingModel: m.scores?.pricing_model,
          userRating: m.scores?.user_rating
        }))
      });

      (metricsList as ToolMetrics[] | null)?.forEach((m) => {
        // Hard filter for free tools only if requested
        if (userPreferences?.freeToolsOnly && m.scores?.pricing_model !== 'free') {
          console.log("Single task - Filtered out non-free tool:", {
            taskName,
            toolName: m.name,
            pricingModel: m.scores?.pricing_model,
            reason: "freeToolsOnly filter applied"
          });
          return; // Skip non-free tools entirely
        }
        
        const scored = computeScore(taskName, m, weights);
        console.log("Single task - Tool score calculated:", {
          taskName,
          toolName: m.name,
          toolId: m.id,
          toolDomains: m.domains,
          pricingModel: m.scores?.pricing_model,
          score: scored.score,
          bench: scored.bench,
          domain: scored.domain,
          cost: scored.cost,
          isBest: !bestTool || scored.score > bestTool.score
        });

        if (!bestTool || scored.score > bestTool.score) {
          console.log("Single task - New best tool found:", {
            taskName,
            toolName: m.name,
            score: scored.score,
            previousBest: bestTool?.metrics.name || "none"
          });
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
        55 + index * 5, // Distribute progress across remaining 35%
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
        55 + index * 5 + 2,
        `"${task.name}" 도구 추천 완료: ${recommendation.toolName || "없음"}`
      );

      let guide = null;
      let guideGenerationDuration = 0;

      // Step 2: Generate guide only if we have a tool
      if (recommendation.toolId && recommendation.toolName) {
        const guideStartTime = Date.now();

        try {
          managedStream.sendProgress(
            `task_${task.id}_guide_start`,
            55 + index * 5 + 3,
            `"${recommendation.toolName}" 가이드 생성 중...`
          );

          const generatedGuide = await guideGenerationService.generateToolGuide(
            {
              toolName: recommendation.toolName,
              taskContext: task.name,
              language: userContext.language,
              userContext,
            }
          );

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
            55 + index * 5 + 4,
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
            error:
              guideError instanceof Error
                ? guideError.message
                : String(guideError),
            guideGenerationDuration,
          });

          managedStream.sendProgress(
            `task_${task.id}_guide_error`,
            55 + index * 5 + 4,
            `"${recommendation.toolName}" 가이드 생성 실패`
          );
        }
      }

      // Send task completion event
      managedStream.sendProgress(
        `task_${task.id}_complete`,
        55 + index * 5 + 5,
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
        55 + index * 5 + 5,
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
      (sum, r) =>
        sum +
        (r.guideGenerationDuration || 0) +
        r.searchDuration +
        r.recommendationDuration,
      0
    ),
  });

  return results;
}
