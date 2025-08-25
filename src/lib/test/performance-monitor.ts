/**
 * Performance Monitoring and Benchmarking Suite for RAG-Enhanced System
 * 
 * Provides comprehensive performance monitoring, benchmarking, and alerting
 * for the RAG-enhanced tool matching system. Includes:
 * - Real-time performance monitoring
 * - Benchmark comparisons (RAG vs Legacy)
 * - System health checks
 * - Performance regression detection
 * - Automated alerting
 */

import { smartRecommendationEngine } from "@/lib/services/smart-recommendation-service";
import { getRelevantToolsWithRAG, getRelevantTools, getRagKnowledgeStats } from "@/lib/supabase/vector-store";
import { SearchStrategy } from "@/types/rag-search";
import { logger } from "@/lib/logger/structured-logger";

export interface PerformanceMetric {
  timestamp: number;
  metricName: string;
  value: number;
  unit: string;
  context?: Record<string, any>;
}

export interface BenchmarkResult {
  testName: string;
  ragPerformance: PerformanceSnapshot;
  legacyPerformance: PerformanceSnapshot;
  improvement: {
    speedImprovement: number; // Positive = RAG is faster
    accuracyImprovement: number; // Positive = RAG is more accurate
    reliabilityImprovement: number; // Positive = RAG is more reliable
  };
  recommendation: string;
}

export interface PerformanceSnapshot {
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number; // requests per second
  successRate: number;
  errorRate: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    ragPipeline: ComponentHealth;
    vectorSearch: ComponentHealth;
    adaptiveSearch: ComponentHealth;
    knowledgeBase: ComponentHealth;
    apiEndpoints: ComponentHealth;
  };
  alerts: Alert[];
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'critical';
  latency: number;
  errorRate: number;
  lastChecked: number;
  details?: Record<string, any>;
}

export interface Alert {
  severity: 'info' | 'warning' | 'critical';
  component: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

/**
 * Real-time Performance Monitor
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 1000; // Keep last 1000 metrics
  private alerts: Alert[] = [];

  /**
   * Record a performance metric
   */
  recordMetric(metricName: string, value: number, unit: string, context?: Record<string, any>) {
    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      metricName,
      value,
      unit,
      context
    };

    this.metrics.push(metric);
    
    // Keep only the last MAX_METRICS
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Check for performance alerts
    this.checkPerformanceThresholds(metric);

    logger.debug("Performance metric recorded", metric);
  }

  /**
   * Get metrics within a time range
   */
  getMetrics(metricName: string, timeRangeMs = 3600000): PerformanceMetric[] { // Default: 1 hour
    const cutoff = Date.now() - timeRangeMs;
    return this.metrics.filter(m => 
      m.metricName === metricName && m.timestamp >= cutoff
    );
  }

  /**
   * Calculate performance statistics
   */
  calculateStats(metricName: string, timeRangeMs = 3600000): PerformanceSnapshot {
    const metrics = this.getMetrics(metricName, timeRangeMs);
    
    if (metrics.length === 0) {
      return {
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        successRate: 0,
        errorRate: 1
      };
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const successMetrics = metrics.filter(m => m.context?.success !== false);
    
    const stats: PerformanceSnapshot = {
      avgResponseTime: values.reduce((sum, v) => sum + v, 0) / values.length,
      p95ResponseTime: values[Math.floor(values.length * 0.95)] || 0,
      p99ResponseTime: values[Math.floor(values.length * 0.99)] || 0,
      throughput: (metrics.length / (timeRangeMs / 1000)), // requests per second
      successRate: successMetrics.length / metrics.length,
      errorRate: (metrics.length - successMetrics.length) / metrics.length
    };

    return stats;
  }

  /**
   * Check performance thresholds and create alerts
   */
  private checkPerformanceThresholds(metric: PerformanceMetric) {
    const thresholds = {
      'response_time': { warning: 1000, critical: 2000 },
      'search_time': { warning: 500, critical: 1000 },
      'error_rate': { warning: 0.05, critical: 0.1 }
    };

    const threshold = thresholds[metric.metricName as keyof typeof thresholds];
    if (!threshold) return;

    if (metric.value >= threshold.critical) {
      this.createAlert('critical', metric.metricName, 
        `${metric.metricName} critically high: ${metric.value}${metric.unit}`, metric.timestamp);
    } else if (metric.value >= threshold.warning) {
      this.createAlert('warning', metric.metricName,
        `${metric.metricName} above warning threshold: ${metric.value}${metric.unit}`, metric.timestamp);
    }
  }

  /**
   * Create a new alert
   */
  private createAlert(severity: Alert['severity'], component: string, message: string, timestamp: number) {
    // Check if similar alert already exists (avoid spam)
    const existingAlert = this.alerts.find(a => 
      a.component === component && 
      a.severity === severity && 
      !a.acknowledged &&
      timestamp - a.timestamp < 300000 // 5 minutes
    );

    if (existingAlert) return;

    const alert: Alert = {
      severity,
      component,
      message,
      timestamp,
      acknowledged: false
    };

    this.alerts.push(alert);
    logger.warn("Performance alert created", alert);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(timestamp: number) {
    const alert = this.alerts.find(a => a.timestamp === timestamp);
    if (alert) {
      alert.acknowledged = true;
    }
  }
}

/**
 * Performance Benchmarking Suite
 */
export class PerformanceBenchmark {
  private monitor = new PerformanceMonitor();

  /**
   * Run comprehensive performance comparison between RAG and Legacy systems
   */
  async runComprehensiveBenchmark(): Promise<BenchmarkResult[]> {
    console.log("🚀 Starting Comprehensive Performance Benchmark");
    console.log("=" .repeat(70));

    const benchmarkTests = [
      {
        name: "Single Query Performance",
        testFunc: this.benchmarkSingleQuery.bind(this),
      },
      {
        name: "Batch Processing Performance", 
        testFunc: this.benchmarkBatchProcessing.bind(this),
      },
      {
        name: "Concurrent Load Performance",
        testFunc: this.benchmarkConcurrentLoad.bind(this),
      },
      {
        name: "Edge Case Handling Performance",
        testFunc: this.benchmarkEdgeCases.bind(this),
      },
      {
        name: "Long-running Stability Test",
        testFunc: this.benchmarkStabilityTest.bind(this),
      }
    ];

    const results: BenchmarkResult[] = [];

    for (const test of benchmarkTests) {
      console.log(`\n⏱️  Running ${test.name}...`);
      try {
        const result = await test.testFunc();
        results.push(result);
        console.log(`✅ ${test.name} completed`);
      } catch (error) {
        console.error(`❌ ${test.name} failed:`, error);
        // Continue with other tests
      }
    }

    console.log("\n" + "=" .repeat(70));
    console.log("🏁 Comprehensive Benchmark Completed");
    
    this.generateBenchmarkReport(results);
    return results;
  }

  /**
   * Benchmark single query performance
   */
  private async benchmarkSingleQuery(): Promise<BenchmarkResult> {
    const testQueries = [
      "Create dashboard for sales analytics",
      "Design mobile app interface",
      "Debug JavaScript application",
      "Set up team collaboration workspace"
    ];

    const ragMetrics: number[] = [];
    const legacyMetrics: number[] = [];
    let ragSuccesses = 0;
    let legacySuccesses = 0;

    // Test RAG-enhanced system
    for (const query of testQueries) {
      const startTime = Date.now();
      try {
        const result = await smartRecommendationEngine.getSmartRecommendationWithRAG(
          query,
          undefined,
          { sessionId: `benchmark-${Date.now()}`, language: "en" },
          { enableRAG: true, enableAdaptive: true }
        );
        const duration = Date.now() - startTime;
        ragMetrics.push(duration);
        if (result.toolId) ragSuccesses++;
        
        this.monitor.recordMetric('rag_query_time', duration, 'ms', { 
          success: !!result.toolId, query 
        });
      } catch (error) {
        ragMetrics.push(Date.now() - startTime);
      }
    }

    // Test legacy system
    for (const query of testQueries) {
      const startTime = Date.now();
      try {
        const result = await smartRecommendationEngine.getSmartRecommendation(
          query,
          undefined,
          { sessionId: `benchmark-legacy-${Date.now()}`, language: "en" }
        );
        const duration = Date.now() - startTime;
        legacyMetrics.push(duration);
        if (result.toolId) legacySuccesses++;

        this.monitor.recordMetric('legacy_query_time', duration, 'ms', { 
          success: !!result.toolId, query 
        });
      } catch (error) {
        legacyMetrics.push(Date.now() - startTime);
      }
    }

    const ragPerformance = this.calculatePerformanceSnapshot(ragMetrics, ragSuccesses, testQueries.length);
    const legacyPerformance = this.calculatePerformanceSnapshot(legacyMetrics, legacySuccesses, testQueries.length);

    return {
      testName: "Single Query Performance",
      ragPerformance,
      legacyPerformance,
      improvement: {
        speedImprovement: (legacyPerformance.avgResponseTime - ragPerformance.avgResponseTime) / legacyPerformance.avgResponseTime,
        accuracyImprovement: ragPerformance.successRate - legacyPerformance.successRate,
        reliabilityImprovement: (legacyPerformance.errorRate - ragPerformance.errorRate) / (legacyPerformance.errorRate || 0.01)
      },
      recommendation: this.generateRecommendation(ragPerformance, legacyPerformance)
    };
  }

  /**
   * Benchmark batch processing performance
   */
  private async benchmarkBatchProcessing(): Promise<BenchmarkResult> {
    const testTasks = [
      { id: "1", name: "Create UI wireframes" },
      { id: "2", name: "Analyze customer feedback" },
      { id: "3", name: "Set up CI/CD pipeline" },
      { id: "4", name: "Design database schema" },
      { id: "5", name: "Plan sprint meeting" }
    ];

    // Test RAG batch processing
    const ragStartTime = Date.now();
    let ragSuccess = false;
    try {
      const ragResults = await smartRecommendationEngine.processTasksInParallelWithRAG(
        testTasks,
        undefined,
        { sessionId: `batch-benchmark-${Date.now()}`, language: "en" },
        `workflow-${Date.now()}`,
        { enableRAG: true, enableAdaptive: true }
      );
      ragSuccess = ragResults.length === testTasks.length;
    } catch (error) {
      console.error("RAG batch processing error:", error);
    }
    const ragDuration = Date.now() - ragStartTime;

    // Test legacy batch processing  
    const legacyStartTime = Date.now();
    let legacySuccess = false;
    try {
      const legacyResults = await smartRecommendationEngine.processTasksInParallel(
        testTasks,
        undefined,
        { sessionId: `batch-legacy-${Date.now()}`, language: "en" },
        `workflow-legacy-${Date.now()}`
      );
      legacySuccess = legacyResults.length === testTasks.length;
    } catch (error) {
      console.error("Legacy batch processing error:", error);
    }
    const legacyDuration = Date.now() - legacyStartTime;

    const ragPerformance: PerformanceSnapshot = {
      avgResponseTime: ragDuration / testTasks.length,
      p95ResponseTime: ragDuration,
      p99ResponseTime: ragDuration,
      throughput: testTasks.length / (ragDuration / 1000),
      successRate: ragSuccess ? 1 : 0,
      errorRate: ragSuccess ? 0 : 1
    };

    const legacyPerformance: PerformanceSnapshot = {
      avgResponseTime: legacyDuration / testTasks.length,
      p95ResponseTime: legacyDuration,
      p99ResponseTime: legacyDuration,
      throughput: testTasks.length / (legacyDuration / 1000),
      successRate: legacySuccess ? 1 : 0,
      errorRate: legacySuccess ? 0 : 1
    };

    this.monitor.recordMetric('rag_batch_time', ragDuration, 'ms', { 
      success: ragSuccess, batchSize: testTasks.length 
    });
    this.monitor.recordMetric('legacy_batch_time', legacyDuration, 'ms', { 
      success: legacySuccess, batchSize: testTasks.length 
    });

    return {
      testName: "Batch Processing Performance",
      ragPerformance,
      legacyPerformance,
      improvement: {
        speedImprovement: (legacyDuration - ragDuration) / legacyDuration,
        accuracyImprovement: ragPerformance.successRate - legacyPerformance.successRate,
        reliabilityImprovement: (legacyPerformance.errorRate - ragPerformance.errorRate) / (legacyPerformance.errorRate || 0.01)
      },
      recommendation: this.generateRecommendation(ragPerformance, legacyPerformance)
    };
  }

  /**
   * Benchmark concurrent load performance
   */
  private async benchmarkConcurrentLoad(): Promise<BenchmarkResult> {
    const concurrentUsers = 10;
    const queriesPerUser = 3;
    const testQuery = "project management tool for agile development";

    // Test RAG concurrent performance
    const ragPromises = Array(concurrentUsers).fill(0).map(async (_, userIndex) => {
      const userMetrics = [];
      for (let i = 0; i < queriesPerUser; i++) {
        const startTime = Date.now();
        try {
          const result = await smartRecommendationEngine.getSmartRecommendationWithRAG(
            `${testQuery} ${i}`,
            undefined,
            { sessionId: `concurrent-rag-${userIndex}-${i}`, language: "en" },
            { enableRAG: true, enableAdaptive: true }
          );
          const duration = Date.now() - startTime;
          userMetrics.push({ duration, success: !!result.toolId });
        } catch (error) {
          userMetrics.push({ duration: Date.now() - startTime, success: false });
        }
      }
      return userMetrics;
    });

    const ragStartTime = Date.now();
    const ragUserResults = await Promise.all(ragPromises);
    const ragTotalTime = Date.now() - ragStartTime;

    // Test legacy concurrent performance
    const legacyPromises = Array(concurrentUsers).fill(0).map(async (_, userIndex) => {
      const userMetrics = [];
      for (let i = 0; i < queriesPerUser; i++) {
        const startTime = Date.now();
        try {
          const result = await smartRecommendationEngine.getSmartRecommendation(
            `${testQuery} ${i}`,
            undefined,
            { sessionId: `concurrent-legacy-${userIndex}-${i}`, language: "en" }
          );
          const duration = Date.now() - startTime;
          userMetrics.push({ duration, success: !!result.toolId });
        } catch (error) {
          userMetrics.push({ duration: Date.now() - startTime, success: false });
        }
      }
      return userMetrics;
    });

    const legacyStartTime = Date.now();
    const legacyUserResults = await Promise.all(legacyPromises);
    const legacyTotalTime = Date.now() - legacyStartTime;

    // Calculate metrics
    const ragAllMetrics = ragUserResults.flat();
    const legacyAllMetrics = legacyUserResults.flat();

    const ragDurations = ragAllMetrics.map(m => m.duration);
    const legacyDurations = legacyAllMetrics.map(m => m.duration);

    const ragSuccesses = ragAllMetrics.filter(m => m.success).length;
    const legacySuccesses = legacyAllMetrics.filter(m => m.success).length;

    const ragPerformance = this.calculatePerformanceSnapshot(ragDurations, ragSuccesses, ragAllMetrics.length);
    const legacyPerformance = this.calculatePerformanceSnapshot(legacyDurations, legacySuccesses, legacyAllMetrics.length);

    // Record concurrent load metrics
    this.monitor.recordMetric('concurrent_load_rag', ragTotalTime, 'ms', { 
      users: concurrentUsers, queriesPerUser 
    });
    this.monitor.recordMetric('concurrent_load_legacy', legacyTotalTime, 'ms', { 
      users: concurrentUsers, queriesPerUser 
    });

    return {
      testName: "Concurrent Load Performance",
      ragPerformance,
      legacyPerformance,
      improvement: {
        speedImprovement: (legacyPerformance.avgResponseTime - ragPerformance.avgResponseTime) / legacyPerformance.avgResponseTime,
        accuracyImprovement: ragPerformance.successRate - legacyPerformance.successRate,
        reliabilityImprovement: (legacyPerformance.errorRate - ragPerformance.errorRate) / (legacyPerformance.errorRate || 0.01)
      },
      recommendation: this.generateRecommendation(ragPerformance, legacyPerformance)
    };
  }

  /**
   * Benchmark edge case handling
   */
  private async benchmarkEdgeCases(): Promise<BenchmarkResult> {
    const edgeCases = [
      "", // Empty query
      "a", // Single character
      "🚀 ⭐ 💡", // Emoji only
      "best tool ever created in the universe", // Very long
      "asdasdlkjasdlkjasljasldkjasldkj", // Nonsense
    ];

    const ragMetrics: number[] = [];
    const legacyMetrics: number[] = [];
    let ragHandled = 0;
    let legacyHandled = 0;

    // Test RAG edge case handling
    for (const edgeCase of edgeCases) {
      const startTime = Date.now();
      try {
        await smartRecommendationEngine.getSmartRecommendationWithRAG(
          edgeCase,
          undefined,
          { sessionId: `edge-rag-${Date.now()}`, language: "en" },
          { enableRAG: true, enableAdaptive: true, fallbackToLegacy: true }
        );
        ragHandled++;
      } catch (error) {
        // Edge case should be handled gracefully, not throw
      }
      ragMetrics.push(Date.now() - startTime);
    }

    // Test legacy edge case handling
    for (const edgeCase of edgeCases) {
      const startTime = Date.now();
      try {
        await smartRecommendationEngine.getSmartRecommendation(
          edgeCase,
          undefined,
          { sessionId: `edge-legacy-${Date.now()}`, language: "en" }
        );
        legacyHandled++;
      } catch (error) {
        // Edge case should be handled gracefully
      }
      legacyMetrics.push(Date.now() - startTime);
    }

    const ragPerformance = this.calculatePerformanceSnapshot(ragMetrics, ragHandled, edgeCases.length);
    const legacyPerformance = this.calculatePerformanceSnapshot(legacyMetrics, legacyHandled, edgeCases.length);

    return {
      testName: "Edge Case Handling Performance", 
      ragPerformance,
      legacyPerformance,
      improvement: {
        speedImprovement: (legacyPerformance.avgResponseTime - ragPerformance.avgResponseTime) / legacyPerformance.avgResponseTime,
        accuracyImprovement: ragPerformance.successRate - legacyPerformance.successRate,
        reliabilityImprovement: (legacyPerformance.errorRate - ragPerformance.errorRate) / (legacyPerformance.errorRate || 0.01)
      },
      recommendation: this.generateRecommendation(ragPerformance, legacyPerformance)
    };
  }

  /**
   * Long-running stability test
   */
  private async benchmarkStabilityTest(): Promise<BenchmarkResult> {
    const testDurationMs = 60000; // 1 minute
    const intervalMs = 2000; // Request every 2 seconds
    const testQuery = "analytics tool for business intelligence";

    const ragMetrics: number[] = [];
    const legacyMetrics: number[] = [];
    let ragSuccesses = 0;
    let legacySuccesses = 0;

    // RAG stability test
    const ragStartTime = Date.now();
    while (Date.now() - ragStartTime < testDurationMs) {
      const startTime = Date.now();
      try {
        const result = await smartRecommendationEngine.getSmartRecommendationWithRAG(
          testQuery,
          undefined,
          { sessionId: `stability-rag-${Date.now()}`, language: "en" },
          { enableRAG: true, enableAdaptive: true }
        );
        if (result.toolId) ragSuccesses++;
      } catch (error) {
        // Count as failure
      }
      ragMetrics.push(Date.now() - startTime);
      
      // Wait for interval
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    // Legacy stability test  
    const legacyStartTime = Date.now();
    while (Date.now() - legacyStartTime < testDurationMs) {
      const startTime = Date.now();
      try {
        const result = await smartRecommendationEngine.getSmartRecommendation(
          testQuery,
          undefined,
          { sessionId: `stability-legacy-${Date.now()}`, language: "en" }
        );
        if (result.toolId) legacySuccesses++;
      } catch (error) {
        // Count as failure
      }
      legacyMetrics.push(Date.now() - startTime);
      
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    const ragPerformance = this.calculatePerformanceSnapshot(ragMetrics, ragSuccesses, ragMetrics.length);
    const legacyPerformance = this.calculatePerformanceSnapshot(legacyMetrics, legacySuccesses, legacyMetrics.length);

    return {
      testName: "Long-running Stability Test",
      ragPerformance,
      legacyPerformance,
      improvement: {
        speedImprovement: (legacyPerformance.avgResponseTime - ragPerformance.avgResponseTime) / legacyPerformance.avgResponseTime,
        accuracyImprovement: ragPerformance.successRate - legacyPerformance.successRate,
        reliabilityImprovement: (legacyPerformance.errorRate - ragPerformance.errorRate) / (legacyPerformance.errorRate || 0.01)
      },
      recommendation: this.generateRecommendation(ragPerformance, legacyPerformance)
    };
  }

  /**
   * Calculate performance snapshot from raw metrics
   */
  private calculatePerformanceSnapshot(durations: number[], successes: number, total: number): PerformanceSnapshot {
    if (durations.length === 0) {
      return {
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        successRate: 0,
        errorRate: 1
      };
    }

    const sortedDurations = [...durations].sort((a, b) => a - b);
    
    return {
      avgResponseTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      p95ResponseTime: sortedDurations[Math.floor(sortedDurations.length * 0.95)] || 0,
      p99ResponseTime: sortedDurations[Math.floor(sortedDurations.length * 0.99)] || 0,
      throughput: 1000 / (durations.reduce((sum, d) => sum + d, 0) / durations.length), // rough approximation
      successRate: successes / total,
      errorRate: (total - successes) / total
    };
  }

  /**
   * Generate performance recommendation
   */
  private generateRecommendation(ragPerf: PerformanceSnapshot, legacyPerf: PerformanceSnapshot): string {
    const speedImprovement = (legacyPerf.avgResponseTime - ragPerf.avgResponseTime) / legacyPerf.avgResponseTime;
    const accuracyImprovement = ragPerf.successRate - legacyPerf.successRate;

    if (speedImprovement > 0.2 && accuracyImprovement > 0.1) {
      return "✅ RAG system shows significant improvements in both speed and accuracy. Recommended for production.";
    } else if (speedImprovement > 0.1 && accuracyImprovement > 0.05) {
      return "✅ RAG system shows good improvements. Consider enabling for production with monitoring.";
    } else if (speedImprovement < -0.2 || accuracyImprovement < -0.1) {
      return "⚠️ RAG system shows performance degradation. Investigate and optimize before production deployment.";
    } else {
      return "📊 RAG system performance is similar to legacy. Monitor closely and consider A/B testing.";
    }
  }

  /**
   * Generate comprehensive benchmark report
   */
  private generateBenchmarkReport(results: BenchmarkResult[]) {
    console.log("\n📊 COMPREHENSIVE BENCHMARK REPORT");
    console.log("=" .repeat(70));

    results.forEach(result => {
      console.log(`\n🔍 ${result.testName}`);
      console.log(`RAG Performance:`);
      console.log(`  Avg Response: ${result.ragPerformance.avgResponseTime.toFixed(0)}ms`);
      console.log(`  P95 Response: ${result.ragPerformance.p95ResponseTime.toFixed(0)}ms`);
      console.log(`  Success Rate: ${(result.ragPerformance.successRate * 100).toFixed(1)}%`);
      console.log(`  Throughput: ${result.ragPerformance.throughput.toFixed(2)} req/s`);

      console.log(`Legacy Performance:`);
      console.log(`  Avg Response: ${result.legacyPerformance.avgResponseTime.toFixed(0)}ms`);
      console.log(`  P95 Response: ${result.legacyPerformance.p95ResponseTime.toFixed(0)}ms`);
      console.log(`  Success Rate: ${(result.legacyPerformance.successRate * 100).toFixed(1)}%`);
      console.log(`  Throughput: ${result.legacyPerformance.throughput.toFixed(2)} req/s`);

      console.log(`Improvements:`);
      console.log(`  Speed: ${(result.improvement.speedImprovement * 100).toFixed(1)}%`);
      console.log(`  Accuracy: ${(result.improvement.accuracyImprovement * 100).toFixed(1)}%`);
      console.log(`  Reliability: ${(result.improvement.reliabilityImprovement * 100).toFixed(1)}%`);

      console.log(`Recommendation: ${result.recommendation}`);
    });

    // Overall summary
    const avgSpeedImprovement = results.reduce((sum, r) => sum + r.improvement.speedImprovement, 0) / results.length;
    const avgAccuracyImprovement = results.reduce((sum, r) => sum + r.improvement.accuracyImprovement, 0) / results.length;

    console.log(`\n🎯 OVERALL SUMMARY`);
    console.log(`Tests Completed: ${results.length}`);
    console.log(`Average Speed Improvement: ${(avgSpeedImprovement * 100).toFixed(1)}%`);
    console.log(`Average Accuracy Improvement: ${(avgAccuracyImprovement * 100).toFixed(1)}%`);
    
    if (avgSpeedImprovement > 0.15 && avgAccuracyImprovement > 0.1) {
      console.log(`✅ RECOMMENDATION: RAG enhancement ready for production deployment`);
    } else if (avgSpeedImprovement > 0.05 && avgAccuracyImprovement > 0.05) {
      console.log(`📊 RECOMMENDATION: RAG enhancement shows promise, consider gradual rollout`);
    } else {
      console.log(`⚠️ RECOMMENDATION: RAG enhancement needs optimization before production`);
    }
  }
}

/**
 * System Health Monitor
 */
export class SystemHealthMonitor {
  
  /**
   * Check overall system health
   */
  async checkSystemHealth(): Promise<SystemHealthStatus> {
    console.log("🏥 Performing System Health Check...");

    const components = {
      ragPipeline: await this.checkRagPipelineHealth(),
      vectorSearch: await this.checkVectorSearchHealth(),
      adaptiveSearch: await this.checkAdaptiveSearchHealth(),
      knowledgeBase: await this.checkKnowledgeBaseHealth(),
      apiEndpoints: await this.checkApiEndpointsHealth()
    };

    const alerts: Alert[] = [];
    
    // Generate alerts for unhealthy components
    Object.entries(components).forEach(([name, health]) => {
      if (health.status === 'critical') {
        alerts.push({
          severity: 'critical',
          component: name,
          message: `${name} is in critical state`,
          timestamp: Date.now(),
          acknowledged: false
        });
      } else if (health.status === 'degraded') {
        alerts.push({
          severity: 'warning',
          component: name,
          message: `${name} performance is degraded`,
          timestamp: Date.now(),
          acknowledged: false
        });
      }
    });

    // Determine overall health
    const criticalComponents = Object.values(components).filter(c => c.status === 'critical').length;
    const degradedComponents = Object.values(components).filter(c => c.status === 'degraded').length;

    let overall: SystemHealthStatus['overall'];
    if (criticalComponents > 0) {
      overall = 'critical';
    } else if (degradedComponents > 1) {
      overall = 'degraded';  
    } else {
      overall = 'healthy';
    }

    const healthStatus: SystemHealthStatus = {
      overall,
      components,
      alerts
    };

    console.log(`System Health: ${overall.toUpperCase()}`);
    if (alerts.length > 0) {
      console.log(`Active Alerts: ${alerts.length}`);
    }

    return healthStatus;
  }

  /**
   * Check RAG pipeline health
   */
  private async checkRagPipelineHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    let status: ComponentHealth['status'] = 'healthy';
    let details = {};

    try {
      // Test RAG pipeline with a simple query
      const result = await smartRecommendationEngine.getSmartRecommendationWithRAG(
        "test health check query",
        undefined,
        { sessionId: `health-check-${Date.now()}`, language: "en" },
        { enableRAG: true, enableAdaptive: true }
      );

      const latency = Date.now() - startTime;
      
      if (latency > 2000) {
        status = 'degraded';
      } else if (latency > 5000) {
        status = 'critical';
      }

      details = {
        hasRecommendation: !!result.toolId,
        searchDuration: result.searchDuration,
        rerankingDuration: result.rerankingDuration,
        searchStrategy: (result as any).searchStrategy
      };

    } catch (error) {
      status = 'critical';
      details = { error: error instanceof Error ? error.message : String(error) };
    }

    return {
      status,
      latency: Date.now() - startTime,
      errorRate: status === 'critical' ? 1 : 0,
      lastChecked: Date.now(),
      details
    };
  }

  /**
   * Check vector search health
   */
  private async checkVectorSearchHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    let status: ComponentHealth['status'] = 'healthy';
    let details = {};

    try {
      const results = await getRelevantTools("health check query", 3);
      const latency = Date.now() - startTime;
      
      if (latency > 1000) {
        status = 'degraded';
      } else if (latency > 3000) {
        status = 'critical';
      }

      details = {
        resultsCount: results.length,
        hasResults: results.length > 0
      };

    } catch (error) {
      status = 'critical';
      details = { error: error instanceof Error ? error.message : String(error) };
    }

    return {
      status,
      latency: Date.now() - startTime,
      errorRate: status === 'critical' ? 1 : 0,
      lastChecked: Date.now(),
      details
    };
  }

  /**
   * Check adaptive search health
   */
  private async checkAdaptiveSearchHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    let status: ComponentHealth['status'] = 'healthy';
    let details = {};

    try {
      const results = await getRelevantToolsWithRAG(
        "adaptive health check", 3, undefined, 
        { enableRAG: false, enableAdaptive: true }
      );
      
      const latency = Date.now() - startTime;
      
      if (latency > 1500) {
        status = 'degraded';
      } else if (latency > 4000) {
        status = 'critical';
      }

      details = {
        resultsCount: results.length,
        strategy: results[0]?.metadata?.search_strategy
      };

    } catch (error) {
      status = 'critical';
      details = { error: error instanceof Error ? error.message : String(error) };
    }

    return {
      status,
      latency: Date.now() - startTime,
      errorRate: status === 'critical' ? 1 : 0,
      lastChecked: Date.now(),
      details
    };
  }

  /**
   * Check knowledge base health
   */
  private async checkKnowledgeBaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    let status: ComponentHealth['status'] = 'healthy';
    let details = {};

    try {
      const stats = await getRagKnowledgeStats();
      
      if (!stats) {
        status = 'critical';
        details = { error: 'Knowledge base not available' };
      } else {
        const qualityScore = stats.knowledge_quality_score;
        const totalEntries = stats.total_knowledge_entries;
        
        if (qualityScore < 0.5 || totalEntries < 10) {
          status = 'degraded';
        } else if (qualityScore < 0.3 || totalEntries < 5) {
          status = 'critical';
        }

        details = {
          totalEntries,
          qualityScore,
          lastUpdated: stats.last_updated
        };
      }

    } catch (error) {
      status = 'critical';
      details = { error: error instanceof Error ? error.message : String(error) };
    }

    return {
      status,
      latency: Date.now() - startTime,
      errorRate: status === 'critical' ? 1 : 0,
      lastChecked: Date.now(),
      details
    };
  }

  /**
   * Check API endpoints health
   */
  private async checkApiEndpointsHealth(): Promise<ComponentHealth> {
    // This would typically make actual HTTP requests to the API endpoints
    // For now, we'll simulate the check
    const status: ComponentHealth['status'] = 'healthy';
    
    return {
      status,
      latency: 150, // Simulated API response time
      errorRate: 0,
      lastChecked: Date.now(),
      details: {
        endpoints: ['smart-recommend', 'rag-status', 'cache'],
        allHealthy: true
      }
    };
  }
}

/**
 * Export performance monitoring instances
 */
export const performanceMonitor = new PerformanceMonitor();
export const performanceBenchmark = new PerformanceBenchmark();
export const systemHealthMonitor = new SystemHealthMonitor();

// Auto-start monitoring if in development mode
if (process.env.NODE_ENV === 'development') {
  // Set up periodic health checks
  setInterval(async () => {
    try {
      const health = await systemHealthMonitor.checkSystemHealth();
      if (health.overall !== 'healthy') {
        console.warn("System health degraded:", health.overall);
      }
    } catch (error) {
      console.error("Health check failed:", error);
    }
  }, 300000); // Every 5 minutes
}