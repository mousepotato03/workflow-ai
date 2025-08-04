import { getEnvVar } from "@/lib/config/env-validation";
import { logger } from "@/lib/logger/structured-logger";

export interface StreamContext {
  workflowId: string;
  userContext: {
    userId?: string;
    sessionId: string;
    language: string;
  };
  startTime: number;
  isAborted: boolean;
  cleanupFunctions: Array<() => void>;
}

export interface StreamEvent {
  eventType: string;
  data: any;
  timestamp: number;
}

/**
 * Enhanced ReadableStream with resource management and timeout handling
 */
export class ManagedReadableStream {
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private encoder = new TextEncoder();
  private context: StreamContext;
  private timeoutId: NodeJS.Timeout | null = null;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private eventCount = 0;

  constructor(context: StreamContext) {
    this.context = context;
  }

  /**
   * Create the ReadableStream with proper resource management
   */
  createStream(): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start: (controller) => {
        this.controller = controller;
        
        // Set up connection timeout (10 minutes max)
        this.timeoutId = setTimeout(() => {
          this.sendError("Connection timeout", { 
            reason: "Stream exceeded maximum duration",
            duration: 10 * 60 * 1000 
          });
          this.cleanup();
        }, 10 * 60 * 1000);

        // Send initial connection event
        this.sendEvent("connected", {
          workflowId: this.context.workflowId,
          timestamp: Date.now(),
        });

        logger.info("Stream connection established", {
          ...this.context.userContext,
          workflowId: this.context.workflowId,
        });
      },

      cancel: (reason) => {
        logger.info("Stream cancelled by client", {
          ...this.context.userContext,
          workflowId: this.context.workflowId,
          reason,
          eventCount: this.eventCount,
          duration: Date.now() - this.context.startTime,
        });
        
        this.context.isAborted = true;
        this.cleanup();
      },
    });
  }

  /**
   * Send Server-Sent Event with validation and error handling
   */
  sendEvent(eventType: string, data: any): boolean {
    if (this.context.isAborted || !this.controller) {
      return false;
    }

    try {
      const event: StreamEvent = {
        eventType,
        data,
        timestamp: Date.now(),
      };

      const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\nid: ${this.eventCount}\n\n`;
      this.controller.enqueue(this.encoder.encode(message));
      
      this.eventCount++;
      
      // Reset timeout on activity
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = setTimeout(() => {
          this.sendError("Connection timeout", { reason: "No activity" });
          this.cleanup();
        }, 10 * 60 * 1000);
      }

      return true;
    } catch (error) {
      logger.error("Failed to send stream event", {
        ...this.context.userContext,
        workflowId: this.context.workflowId,
        eventType,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      
      this.cleanup();
      return false;
    }
  }

  /**
   * Send progress update
   */
  sendProgress(stage: string, progress: number, message?: string): boolean {
    return this.sendEvent("progress", {
      stage,
      progress: Math.min(100, Math.max(0, progress)),
      message,
      workflowId: this.context.workflowId,
    });
  }

  /**
   * Send error event
   */
  sendError(error: string, details?: any): boolean {
    const success = this.sendEvent("error", {
      error,
      details,
      workflowId: this.context.workflowId,
    });

    logger.error("Stream error sent", {
      ...this.context.userContext,
      workflowId: this.context.workflowId,
      error,
      details,
    });

    return success;
  }

  /**
   * Send completion event and cleanup
   */
  sendComplete(result: any): boolean {
    const success = this.sendEvent("complete", {
      result,
      workflowId: this.context.workflowId,
      duration: Date.now() - this.context.startTime,
      eventCount: this.eventCount,
    });

    logger.info("Stream completed successfully", {
      ...this.context.userContext,
      workflowId: this.context.workflowId,
      duration: Date.now() - this.context.startTime,
      eventCount: this.eventCount,
    });

    this.cleanup();
    return success;
  }

  /**
   * Check if stream is still active
   */
  isActive(): boolean {
    return !this.context.isAborted && this.controller !== null;
  }

  /**
   * Add cleanup function to be called when stream ends
   */
  addCleanupFunction(fn: () => void): void {
    this.context.cleanupFunctions.push(fn);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    // Mark as aborted
    this.context.isAborted = true;

    // Clear timeouts
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }

    // Run cleanup functions
    this.context.cleanupFunctions.forEach(fn => {
      try {
        fn();
      } catch (error) {
        logger.warn("Cleanup function failed", {
          ...this.context.userContext,
          workflowId: this.context.workflowId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
    this.context.cleanupFunctions = [];

    // Close controller
    try {
      if (this.controller) {
        this.controller.close();
        this.controller = null;
      }
    } catch (error) {
      // Controller might already be closed
    }

    logger.debug("Stream cleanup completed", {
      ...this.context.userContext,
      workflowId: this.context.workflowId,
      duration: Date.now() - this.context.startTime,
      eventCount: this.eventCount,
    });
  }
}

/**
 * Create a managed stream with proper resource handling
 */
export function createManagedStream(
  workflowId: string,
  userContext: { userId?: string; sessionId: string; language: string }
): ManagedReadableStream {
  const context: StreamContext = {
    workflowId,
    userContext,
    startTime: Date.now(),
    isAborted: false,
    cleanupFunctions: [],
  };

  return new ManagedReadableStream(context);
}

/**
 * Stream response headers for Server-Sent Events
 */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;