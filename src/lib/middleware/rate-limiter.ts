import { NextRequest } from "next/server";
import { logger } from "@/lib/logger/structured-logger";

// Simple in-memory rate limiter
// In production, use Redis or similar distributed cache
interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastRequest: number;
}

class InMemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60 * 1000, maxRequests: number = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Cleanup expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if request is allowed
   */
  isAllowed(identifier: string): { allowed: boolean; remainingRequests: number; resetTime: number } {
    const now = Date.now();
    let entry = this.store.get(identifier);

    // Create new entry if doesn't exist or reset window has passed
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + this.windowMs,
        lastRequest: now,
      };
      this.store.set(identifier, entry);

      return {
        allowed: true,
        remainingRequests: this.maxRequests - 1,
        resetTime: entry.resetTime,
      };
    }

    // Update existing entry
    entry.count++;
    entry.lastRequest = now;

    const allowed = entry.count <= this.maxRequests;
    const remainingRequests = Math.max(0, this.maxRequests - entry.count);

    return {
      allowed,
      remainingRequests,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        this.store.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug("Rate limiter cleanup completed", {
        cleanedEntries: cleanedCount,
        remainingEntries: this.store.size,
      });
    }
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      totalEntries: this.store.size,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests,
    };
  }
}

// Rate limiter instances for different endpoints
export const workflowRateLimiter = new InMemoryRateLimiter(60 * 1000, 10); // 10 requests per minute
export const systemRateLimiter = new InMemoryRateLimiter(60 * 1000, 30); // 30 requests per minute

/**
 * Extract identifier for rate limiting (IP + User-Agent)
 */
export function getRateLimitIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : 
             request.headers.get("x-real-ip") || 
             "unknown";
  
  const userAgent = request.headers.get("user-agent") || "unknown";
  
  // Create a simple hash of IP + User-Agent for identifier
  return `${ip}:${userAgent.slice(0, 50)}`;
}

/**
 * Rate limiting middleware
 */
export function withRateLimit(
  rateLimiter: InMemoryRateLimiter,
  skipCondition?: (request: NextRequest) => boolean
) {
  return function rateLimitMiddleware(request: NextRequest) {
    // Skip rate limiting if condition is met
    if (skipCondition && skipCondition(request)) {
      return { allowed: true, remainingRequests: 999, resetTime: Date.now() + 60000 };
    }

    const identifier = getRateLimitIdentifier(request);
    const result = rateLimiter.isAllowed(identifier);

    if (!result.allowed) {
      logger.warn("Rate limit exceeded", {
        identifier: identifier.substring(0, 20) + "...", // Masked for privacy
        resetTime: new Date(result.resetTime).toISOString(),
        remainingRequests: result.remainingRequests,
      });
    }

    return result;
  };
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(resetTime: number) {
  return new Response(
    JSON.stringify({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Please try again later.",
      resetTime: new Date(resetTime).toISOString(),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": Math.ceil((resetTime - Date.now()) / 1000).toString(),
        "X-RateLimit-Reset": resetTime.toString(),
      },
    }
  );
}