import { NextRequest, NextResponse } from "next/server";
import { CacheUtils } from "@/lib/cache/memory-cache";
import { logger } from "@/lib/logger/structured-logger";
import { withIPWhitelist, createIPWhitelistErrorResponse } from "@/lib/middleware/auth";
import { withRateLimit, systemRateLimiter, createRateLimitResponse } from "@/lib/middleware/rate-limiter";

export async function GET(request: NextRequest) {
  // Apply IP whitelist for system endpoints
  const ipWhitelistCheck = withIPWhitelist();
  if (!ipWhitelistCheck(request)) {
    return createIPWhitelistErrorResponse();
  }

  // Apply rate limiting
  const rateLimitCheck = withRateLimit(systemRateLimiter);
  const rateLimitResult = rateLimitCheck(request);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult.resetTime);
  }
  try {
    // Get cache statistics
    const cacheStats = CacheUtils.getAllStats();

    // Get recent log entries for system health
    const recentErrors = logger.getLogsByLevel(3, 10); // LogLevel.ERROR = 3
    const recentWarnings = logger.getLogsByLevel(2, 5); // LogLevel.WARN = 2

    // Calculate system health metrics
    const systemHealth = {
      status: "healthy",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };

    // Determine overall health status
    if (recentErrors.length > 5) {
      systemHealth.status = "degraded";
    } else if (recentErrors.length > 0) {
      systemHealth.status = "warning";
    }

    const response = {
      system: systemHealth,
      cache: {
        stats: cacheStats,
        health: {
          workflow:
            cacheStats.workflow.hitRate > 0.7 ? "good" : "needs_improvement",
          toolSearch:
            cacheStats.toolSearch.hitRate > 0.6 ? "good" : "needs_improvement",
          taskDecomposition:
            cacheStats.taskDecomposition.hitRate > 0.8
              ? "good"
              : "needs_improvement",
        },
      },
      logs: {
        recentErrors: recentErrors.length,
        recentWarnings: recentWarnings.length,
        lastError: recentErrors[0]?.timestamp || null,
        lastWarning: recentWarnings[0]?.timestamp || null,
      },
      features: {
        vectorSearch: "enabled",
        caching: "enabled",
        realTimeStreaming: "enabled",
        structuredLogging: "enabled",
      },
    };

    logger.info("System status requested", {
      systemStatus: systemHealth.status,
      cacheHitRates: {
        workflow: cacheStats.workflow.hitRate,
        toolSearch: cacheStats.toolSearch.hitRate,
        taskDecomposition: cacheStats.taskDecomposition.hitRate,
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error(
      "Failed to get system status",
      {},
      error instanceof Error ? error : new Error(String(error))
    );

    return NextResponse.json(
      { error: "Failed to retrieve system status" },
      { status: 500 }
    );
  }
}
