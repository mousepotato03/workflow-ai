import { NextRequest } from "next/server";
import { logger } from "@/lib/logger/structured-logger";
import { getEnvVar } from "@/lib/config/env-validation";

/**
 * Simple API key authentication
 * In production, consider using JWT or OAuth2
 */
export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  reason?: string;
}

/**
 * Extract API key from request headers
 */
function getApiKeyFromRequest(request: NextRequest): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Check X-API-Key header
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  return null;
}

/**
 * Validate API key
 * In production, this should check against a database or service
 */
function validateApiKey(apiKey: string): AuthResult {
  // For now, use a simple validation
  // In production, implement proper key validation with database lookup
  
  // Allow requests without API key in development
  if (process.env.NODE_ENV === "development") {
    return {
      authenticated: true,
      userId: "dev-user",
    };
  }

  // Check for valid API key format (basic validation)
  if (!apiKey || apiKey.length < 32) {
    return {
      authenticated: false,
      reason: "Invalid API key format",
    };
  }

  // For demo purposes, accept any key that starts with "wf_"
  if (apiKey.startsWith("wf_") && apiKey.length >= 36) {
    return {
      authenticated: true,
      userId: `user_${apiKey.slice(-8)}`, // Use last 8 chars as user ID
    };
  }

  return {
    authenticated: false,
    reason: "Invalid API key",
  };
}

/**
 * Check if request is from localhost (development)
 */
function isLocalhost(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : 
             request.headers.get("x-real-ip") || 
             "unknown";
  
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
}

/**
 * Authentication middleware
 */
export function withAuth(options: {
  requireAuth?: boolean;
  allowLocalhost?: boolean;
  publicPaths?: string[];
} = {}) {
  const {
    requireAuth = true,
    allowLocalhost = true,
    publicPaths = [],
  } = options;

  return function authMiddleware(request: NextRequest): AuthResult {
    const pathname = new URL(request.url).pathname;

    // Check if path is public
    if (publicPaths.some(path => pathname.startsWith(path))) {
      return {
        authenticated: true,
        userId: "anonymous",
      };
    }

    // Allow localhost in development
    if (allowLocalhost && process.env.NODE_ENV === "development" && isLocalhost(request)) {
      return {
        authenticated: true,
        userId: "localhost",
      };
    }

    // Skip authentication if not required
    if (!requireAuth) {
      return {
        authenticated: true,
        userId: "anonymous",
      };
    }

    // Extract and validate API key
    const apiKey = getApiKeyFromRequest(request);
    
    if (!apiKey) {
      logger.warn("Missing API key", {
        pathname,
        userAgent: request.headers.get("user-agent")?.substring(0, 100),
      });
      
      return {
        authenticated: false,
        reason: "API key required",
      };
    }

    const authResult = validateApiKey(apiKey);
    
    if (!authResult.authenticated) {
      logger.warn("Authentication failed", {
        pathname,
        reason: authResult.reason,
        apiKeyPrefix: apiKey.substring(0, 8) + "...",
      });
    } else {
      logger.debug("Authentication successful", {
        pathname,
        userId: authResult.userId,
      });
    }

    return authResult;
  };
}

/**
 * Create authentication error response
 */
export function createAuthErrorResponse(reason: string = "Authentication required") {
  return new Response(
    JSON.stringify({
      error: "Unauthorized",
      message: reason,
      hint: "Include a valid API key in the Authorization header (Bearer token) or X-API-Key header",
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": "Bearer",
      },
    }
  );
}

/**
 * IP whitelist for system endpoints
 */
const ALLOWED_IPS = [
  "127.0.0.1",
  "::1",
  "localhost",
  // Add production IPs here
];

/**
 * IP whitelist middleware for system endpoints
 */
export function withIPWhitelist() {
  return function ipWhitelistMiddleware(request: NextRequest): boolean {
    if (process.env.NODE_ENV === "development") {
      return true; // Allow all IPs in development
    }

    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : 
               request.headers.get("x-real-ip") || 
               "unknown";

    const allowed = ALLOWED_IPS.includes(ip);
    
    if (!allowed) {
      logger.warn("IP not whitelisted", {
        ip,
        pathname: new URL(request.url).pathname,
      });
    }

    return allowed;
  };
}

/**
 * Create IP whitelist error response
 */
export function createIPWhitelistErrorResponse() {
  return new Response(
    JSON.stringify({
      error: "Forbidden",
      message: "Access denied from this IP address",
    }),
    {
      status: 403,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}