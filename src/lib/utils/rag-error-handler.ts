/**
 * Comprehensive error handling and fallback mechanisms for RAG-enhanced search
 */

import { logger } from "@/lib/logger/structured-logger";
import { 
  RagSearchError, 
  RagSearchErrorType, 
  SearchStrategy 
} from "@/types/rag-search";

export interface ErrorContext {
  taskName?: string;
  strategy?: SearchStrategy;
  userPreferences?: any;
  requestId?: string;
  timestamp?: string;
}

export interface FallbackConfig {
  maxRetries: number;
  retryDelayMs: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerResetTime: number;
}

export class RagErrorHandler {
  private static instance: RagErrorHandler;
  private failureCounts = new Map<SearchStrategy, number>();
  private lastFailureTime = new Map<SearchStrategy, number>();
  private circuitBreakerOpen = new Map<SearchStrategy, boolean>();
  
  private readonly config: FallbackConfig = {
    maxRetries: 3,
    retryDelayMs: 1000,
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 5,
    circuitBreakerResetTime: 60000 // 1 minute
  };

  static getInstance(): RagErrorHandler {
    if (!RagErrorHandler.instance) {
      RagErrorHandler.instance = new RagErrorHandler();
    }
    return RagErrorHandler.instance;
  }

  /**
   * Handle RAG search errors with intelligent fallback
   */
  async handleSearchError(
    error: Error | RagSearchError,
    context: ErrorContext,
    fallbackStrategies: SearchStrategy[] = []
  ): Promise<{
    shouldFallback: boolean;
    nextStrategy?: SearchStrategy;
    errorCategory: RagSearchErrorType;
    retryRecommended: boolean;
  }> {
    const errorCategory = this.categorizeError(error);
    const strategy = context.strategy || SearchStrategy.KEYWORD;

    // Log the error with context
    logger.error("RAG search error occurred", {
      errorType: error.name,
      errorMessage: error.message,
      errorCategory,
      strategy,
      context,
      timestamp: new Date().toISOString()
    });

    // Update failure tracking
    this.trackFailure(strategy);

    // Check circuit breaker
    const isCircuitOpen = this.isCircuitBreakerOpen(strategy);
    if (isCircuitOpen) {
      logger.warn("Circuit breaker open for strategy", { strategy });
    }

    // Determine fallback strategy
    const nextStrategy = this.getNextFallbackStrategy(
      strategy, 
      fallbackStrategies,
      isCircuitOpen
    );

    const shouldFallback = nextStrategy !== undefined;
    const retryRecommended = this.shouldRetry(errorCategory, context);

    logger.info("Error handling decision", {
      errorCategory,
      currentStrategy: strategy,
      nextStrategy,
      shouldFallback,
      retryRecommended,
      circuitBreakerOpen: isCircuitOpen,
      context
    });

    return {
      shouldFallback,
      nextStrategy,
      errorCategory,
      retryRecommended
    };
  }

  /**
   * Categorize error for appropriate handling
   */
  private categorizeError(error: Error | RagSearchError): RagSearchErrorType {
    if (error instanceof RagSearchError) {
      return error.type;
    }

    const message = error.message.toLowerCase();

    // Database-related errors
    if (message.includes('function') && message.includes('not') && message.includes('exist')) {
      return RagSearchErrorType.DATABASE_FUNCTION_NOT_FOUND;
    }

    // Embedding generation errors
    if (message.includes('embedding') || message.includes('api key') || message.includes('quota')) {
      return RagSearchErrorType.EMBEDDING_GENERATION_FAILED;
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return RagSearchErrorType.TIMEOUT_EXCEEDED;
    }

    // Query parsing errors
    if (message.includes('query') || message.includes('parse') || message.includes('invalid')) {
      return RagSearchErrorType.QUERY_PARSING_FAILED;
    }

    // Default to query parsing failed for unknown errors
    return RagSearchErrorType.QUERY_PARSING_FAILED;
  }

  /**
   * Track failure for circuit breaker pattern
   */
  private trackFailure(strategy: SearchStrategy): void {
    const currentCount = this.failureCounts.get(strategy) || 0;
    this.failureCounts.set(strategy, currentCount + 1);
    this.lastFailureTime.set(strategy, Date.now());

    // Check if circuit breaker should open
    if (this.config.enableCircuitBreaker && 
        currentCount >= this.config.circuitBreakerThreshold) {
      this.circuitBreakerOpen.set(strategy, true);
      logger.warn("Circuit breaker opened for strategy", { 
        strategy, 
        failureCount: currentCount 
      });
    }
  }

  /**
   * Check if circuit breaker is open for strategy
   */
  private isCircuitBreakerOpen(strategy: SearchStrategy): boolean {
    if (!this.config.enableCircuitBreaker) {
      return false;
    }

    const isOpen = this.circuitBreakerOpen.get(strategy) || false;
    
    if (isOpen) {
      // Check if enough time has passed to reset
      const lastFailure = this.lastFailureTime.get(strategy) || 0;
      const timeSinceLastFailure = Date.now() - lastFailure;
      
      if (timeSinceLastFailure >= this.config.circuitBreakerResetTime) {
        // Reset circuit breaker
        this.circuitBreakerOpen.set(strategy, false);
        this.failureCounts.set(strategy, 0);
        logger.info("Circuit breaker reset for strategy", { strategy });
        return false;
      }
    }

    return isOpen;
  }

  /**
   * Get next fallback strategy based on current failure and availability
   */
  private getNextFallbackStrategy(
    currentStrategy: SearchStrategy,
    fallbackStrategies: SearchStrategy[],
    skipCircuitOpenStrategies: boolean = true
  ): SearchStrategy | undefined {
    // Find current strategy index
    const currentIndex = fallbackStrategies.indexOf(currentStrategy);
    
    if (currentIndex === -1 || currentIndex >= fallbackStrategies.length - 1) {
      return undefined; // No more fallback strategies
    }

    // Try next strategies in order
    for (let i = currentIndex + 1; i < fallbackStrategies.length; i++) {
      const strategy = fallbackStrategies[i];
      
      // Skip if circuit breaker is open for this strategy
      if (skipCircuitOpenStrategies && this.isCircuitBreakerOpen(strategy)) {
        continue;
      }
      
      return strategy;
    }

    return undefined;
  }

  /**
   * Determine if retry is recommended based on error type
   */
  private shouldRetry(errorCategory: RagSearchErrorType, context: ErrorContext): boolean {
    switch (errorCategory) {
      case RagSearchErrorType.TIMEOUT_EXCEEDED:
      case RagSearchErrorType.EMBEDDING_GENERATION_FAILED:
        return true; // Transient errors, retry may help
      
      case RagSearchErrorType.DATABASE_FUNCTION_NOT_FOUND:
      case RagSearchErrorType.INSUFFICIENT_KNOWLEDGE_BASE:
        return false; // Structural errors, retry won't help
      
      case RagSearchErrorType.QUERY_PARSING_FAILED:
      case RagSearchErrorType.FALLBACK_EXHAUSTED:
        return false; // Logic errors, retry won't help
      
      default:
        return true; // Default to retry for unknown errors
    }
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    maxRetries?: number
  ): Promise<T> {
    const retries = maxRetries || this.config.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.debug("Executing operation attempt", { 
          attempt, 
          maxRetries: retries, 
          context 
        });
        
        const result = await operation();
        
        if (attempt > 1) {
          logger.info("Operation succeeded on retry", { 
            attempt, 
            context 
          });
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        logger.warn("Operation attempt failed", {
          attempt,
          maxRetries: retries,
          error: lastError.message,
          context
        });

        // Don't retry on last attempt
        if (attempt === retries) {
          break;
        }

        // Check if retry is recommended
        const errorCategory = this.categorizeError(lastError);
        const shouldRetry = this.shouldRetry(errorCategory, context);
        
        if (!shouldRetry) {
          logger.info("Retry not recommended for error type", { 
            errorCategory, 
            context 
          });
          break;
        }

        // Wait before retry
        await this.delay(this.config.retryDelayMs * attempt);
      }
    }

    throw lastError || new Error("Operation failed after retries");
  }

  /**
   * Reset circuit breaker for a strategy (manual intervention)
   */
  resetCircuitBreaker(strategy: SearchStrategy): void {
    this.circuitBreakerOpen.set(strategy, false);
    this.failureCounts.set(strategy, 0);
    this.lastFailureTime.delete(strategy);
    
    logger.info("Circuit breaker manually reset", { strategy });
  }

  /**
   * Get failure statistics for monitoring
   */
  getFailureStats(): Record<SearchStrategy, {
    failureCount: number;
    circuitBreakerOpen: boolean;
    lastFailureTime?: number;
  }> {
    const stats: Record<string, any> = {};
    
    for (const strategy of Object.values(SearchStrategy)) {
      stats[strategy] = {
        failureCount: this.failureCounts.get(strategy) || 0,
        circuitBreakerOpen: this.circuitBreakerOpen.get(strategy) || false,
        lastFailureTime: this.lastFailureTime.get(strategy)
      };
    }
    
    return stats;
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const ragErrorHandler = RagErrorHandler.getInstance();