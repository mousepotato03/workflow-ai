/**
 * Structured logging system for better error tracking and debugging
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableStructured: boolean;
}

class StructuredLogger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 100;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      minLevel:
        process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG,
      enableConsole: true,
      enableStructured: true,
      ...config,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.minLevel;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
      // Extract from context if available
      userId: context?.userId,
      sessionId: context?.sessionId,
      requestId: context?.requestId,
    };
  }

  private formatConsoleOutput(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const timestamp = entry.timestamp;
    const context = entry.context
      ? ` | Context: ${JSON.stringify(entry.context)}`
      : "";
    const error = entry.error ? ` | Error: ${entry.error.message}` : "";

    return `[${timestamp}] ${levelName}: ${entry.message}${context}${error}`;
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);

    // Keep buffer size under control
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, context, error);

    // Add to buffer for potential external logging services
    this.addToBuffer(entry);

    // Console output
    if (this.config.enableConsole) {
      const output = this.formatConsoleOutput(entry);

      switch (level) {
        case LogLevel.DEBUG:
          console.debug(output);
          break;
        case LogLevel.INFO:
          console.info(output);
          break;
        case LogLevel.WARN:
          console.warn(output);
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(output);
          if (error) {
            console.error(error.stack);
          }
          break;
      }
    }

    // Structured output for external services (e.g., monitoring)
    if (this.config.enableStructured && level >= LogLevel.WARN) {
      // In production, you might send this to monitoring services
      // like DataDog, New Relic, or Sentry
      this.sendToMonitoring(entry);
    }
  }

  private sendToMonitoring(entry: LogEntry): void {
    // Placeholder for external monitoring integration
    // In production, implement actual monitoring service calls
    if (process.env.NODE_ENV === "development") {
      console.log("📊 Monitoring:", JSON.stringify(entry, null, 2));
    }
  }

  // Public logging methods
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  fatal(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.FATAL, message, context, error);
  }

  // Specialized logging methods for specific domains
  apiRequest(
    method: string,
    url: string,
    duration: number,
    statusCode: number,
    context?: Record<string, any>
  ): void {
    this.info(`API ${method} ${url}`, {
      ...context,
      method,
      url,
      duration,
      statusCode,
      type: "api_request",
    });
  }

  apiError(
    method: string,
    url: string,
    error: Error,
    context?: Record<string, any>
  ): void {
    this.error(
      `API Error ${method} ${url}`,
      {
        ...context,
        method,
        url,
        type: "api_error",
      },
      error
    );
  }

  workflowStart(
    workflowId: string,
    goal: string,
    context?: Record<string, any>
  ): void {
    this.info("Workflow started", {
      ...context,
      workflowId,
      goal,
      type: "workflow_start",
    });
  }

  workflowComplete(
    workflowId: string,
    duration: number,
    taskCount: number,
    context?: Record<string, any>
  ): void {
    this.info("Workflow completed", {
      ...context,
      workflowId,
      duration,
      taskCount,
      type: "workflow_complete",
    });
  }

  workflowError(
    workflowId: string,
    error: Error,
    context?: Record<string, any>
  ): void {
    this.error(
      "Workflow failed",
      {
        ...context,
        workflowId,
        type: "workflow_error",
      },
      error
    );
  }

  searchPerformance(
    searchType: string,
    query: string,
    duration: number,
    resultCount: number,
    context?: Record<string, any>
  ): void {
    this.info("Search performance", {
      ...context,
      searchType,
      query: query.substring(0, 50), // Truncate for privacy
      duration,
      resultCount,
      type: "search_performance",
    });
  }

  cacheHit(
    cacheType: string,
    key: string,
    context?: Record<string, any>
  ): void {
    this.debug("Cache hit", {
      ...context,
      cacheType,
      key: key.substring(0, 50), // Truncate for readability
      type: "cache_hit",
    });
  }

  cacheMiss(
    cacheType: string,
    key: string,
    context?: Record<string, any>
  ): void {
    this.debug("Cache miss", {
      ...context,
      cacheType,
      key: key.substring(0, 50),
      type: "cache_miss",
    });
  }

  // Get recent logs for debugging
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  // Get logs by level
  getLogsByLevel(level: LogLevel, count: number = 50): LogEntry[] {
    return this.logBuffer
      .filter((entry) => entry.level === level)
      .slice(-count);
  }

  // Clear log buffer
  clearBuffer(): void {
    this.logBuffer = [];
  }
}

// Create singleton logger instance
export const logger = new StructuredLogger();

// Helper function to extract user context from request
export const extractUserContext = (request?: any): Record<string, any> => {
  if (!request) return {};

  return {
    userAgent: request.headers?.["user-agent"],
    ip: request.headers?.["x-forwarded-for"] || request.headers?.["x-real-ip"],
    referer: request.headers?.referer,
    requestId: request.headers?.["x-request-id"] || crypto.randomUUID(),
  };
};

// Export types for external use
export type { LogEntry, LoggerConfig };
