import { NextRequest, NextResponse } from "next/server";
import {
  workflowCache,
  toolSearchCache,
  taskDecompositionCache,
  CacheUtils,
} from "@/lib/cache/memory-cache";
import { logger } from "@/lib/logger/structured-logger";

export async function GET() {
  try {
    const stats = CacheUtils.getAllStats();

    logger.info("Cache statistics requested", { cacheStats: stats });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      caches: {
        workflow: {
          ...stats.workflow,
          description: "Workflow request results cache",
          ttl: "10 minutes",
        },
        toolSearch: {
          ...stats.toolSearch,
          description: "Tool search results cache",
          ttl: "15 minutes",
        },
        taskDecomposition: {
          ...stats.taskDecomposition,
          description: "Task decomposition results cache",
          ttl: "20 minutes",
        },
      },
      overall: {
        totalEntries:
          stats.workflow.entries +
          stats.toolSearch.entries +
          stats.taskDecomposition.entries,
        averageHitRate:
          (stats.workflow.hitRate +
            stats.toolSearch.hitRate +
            stats.taskDecomposition.hitRate) /
          3,
        recommendations: {
          workflow:
            stats.workflow.hitRate < 0.7
              ? "Consider increasing cache TTL"
              : "Performance looks good",
          toolSearch:
            stats.toolSearch.hitRate < 0.6
              ? "May need cache size optimization"
              : "Performance looks good",
          taskDecomposition:
            stats.taskDecomposition.hitRate < 0.8
              ? "Consider pre-warming cache"
              : "Performance looks good",
        },
      },
    });
  } catch (error) {
    logger.error(
      "Failed to get cache statistics",
      {},
      error instanceof Error ? error : new Error(String(error))
    );

    return NextResponse.json(
      { error: "Failed to retrieve cache statistics" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const cacheType = url.searchParams.get("type");
    const pattern = url.searchParams.get("pattern");

    let cleared = 0;

    if (pattern) {
      // Clear entries matching pattern
      if (!cacheType || cacheType === "workflow") {
        cleared += CacheUtils.invalidatePattern(workflowCache, pattern);
      }
      if (!cacheType || cacheType === "toolSearch") {
        cleared += CacheUtils.invalidatePattern(toolSearchCache, pattern);
      }
      if (!cacheType || cacheType === "taskDecomposition") {
        cleared += CacheUtils.invalidatePattern(
          taskDecompositionCache,
          pattern
        );
      }

      logger.info("Cache entries cleared by pattern", {
        pattern,
        cleared,
        cacheType,
      });
    } else if (cacheType) {
      // Clear specific cache type
      switch (cacheType) {
        case "workflow":
          workflowCache.clear();
          cleared = 1;
          break;
        case "toolSearch":
          toolSearchCache.clear();
          cleared = 1;
          break;
        case "taskDecomposition":
          taskDecompositionCache.clear();
          cleared = 1;
          break;
        default:
          return NextResponse.json(
            {
              error:
                "Invalid cache type. Use: workflow, toolSearch, or taskDecomposition",
            },
            { status: 400 }
          );
      }

      logger.info("Cache cleared", { cacheType });
    } else {
      // Clear all caches
      workflowCache.clear();
      toolSearchCache.clear();
      taskDecompositionCache.clear();
      cleared = 3;

      logger.info("All caches cleared");
    }

    return NextResponse.json({
      success: true,
      message: `Cache cleared successfully`,
      cleared,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      "Failed to clear cache",
      {},
      error instanceof Error ? error : new Error(String(error))
    );

    return NextResponse.json(
      { error: "Failed to clear cache" },
      { status: 500 }
    );
  }
}
