/**
 * Comprehensive RAG-Enhanced Tool Matching Test Suite
 * 
 * This test suite validates the entire RAG enhancement implementation including:
 * - Accuracy testing: Compare recommendation quality before/after RAG
 * - Performance testing: Ensure performance requirements are met
 * - Integration testing: Validate full pipeline from indexing to recommendation
 * - Regression testing: Ensure existing functionality still works
 * - Edge case testing: Handle various query types and error conditions
 */

import { 
  ragEnhancedSearchTools,
  adaptiveSearchTools,
  getRelevantToolsWithRAG,
  getRagKnowledgeStats,
  detectQueryType,
  getAdaptiveSearchParams,
  getRelevantTools
} from "@/lib/supabase/vector-store";

import { smartRecommendationEngine } from "@/lib/services/smart-recommendation-service";
import { ragErrorHandler } from "@/lib/utils/rag-error-handler";
import { SearchStrategy, QueryType, RagSearchOptions } from "@/types/rag-search";
import { TaskType } from "@/lib/services/smart-recommendation-service";

export interface TestResult {
  testName: string;
  passed: boolean;
  score?: number;
  executionTime: number;
  details: any;
  error?: string;
}

export interface AccuracyMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  meanReciprocalRank: number;
  ndcg: number; // Normalized Discounted Cumulative Gain
  confidenceScore: number;
  coverageScore: number;
}

export interface PerformanceMetrics {
  avgSearchTime: number;
  avgRerankingTime: number;
  avgTotalTime: number;
  throughput: number; // queries per second
  memoryUsage?: number;
  cacheHitRate?: number;
}

export interface ComparisonResult {
  ragResults: any[];
  legacyResults: any[];
  improvementMetrics: {
    accuracyImprovement: number;
    performanceImpact: number;
    relevanceImprovement: number;
    confidenceImprovement: number;
  };
}

/**
 * Test data factory for creating consistent test scenarios
 */
export class TestDataFactory {
  static readonly GROUND_TRUTH_MAPPINGS = {
    // Design tasks should recommend design tools
    "Create UI mockups for mobile app": ["Figma", "Sketch", "Adobe XD"],
    "Design website wireframes": ["Figma", "Balsamiq", "Sketch"],
    "Create logo design": ["Adobe Illustrator", "Canva", "Logo Maker"],
    
    // Development tasks should recommend coding tools
    "Write Python web scraper": ["VS Code", "PyCharm", "Jupyter Notebook"],
    "Build REST API": ["Postman", "Insomnia", "VS Code"],
    "Debug JavaScript code": ["Chrome DevTools", "VS Code", "WebStorm"],
    
    // Analytics tasks should recommend data tools
    "Analyze customer data": ["Tableau", "Power BI", "Google Analytics"],
    "Create dashboard reports": ["Tableau", "Power BI", "Looker"],
    "Process large datasets": ["Python", "R", "Apache Spark"],
    
    // Communication tasks should recommend collaboration tools
    "Set up team chat": ["Slack", "Microsoft Teams", "Discord"],
    "Schedule team meetings": ["Calendly", "Google Calendar", "Zoom"],
    "Share project files": ["Google Drive", "Dropbox", "OneDrive"],
    
    // Edge cases and ambiguous queries
    "best tool": [], // Should handle vague queries gracefully
    "tool for work": [], // Should ask for clarification
    "": [], // Empty query
    "asdasdasdasd": [] // Nonsensical query
  };

  static readonly PERFORMANCE_TEST_QUERIES = [
    "design tool for mobile app mockups",
    "analytics software for business intelligence",
    "code editor for web development",
    "project management tool for agile teams",
    "video editing software for content creation"
  ];

  static readonly EDGE_CASE_QUERIES = [
    "", // Empty query
    "a", // Single character
    "best tool ever made in the history of mankind", // Very long query
    "tool tool tool tool tool", // Repetitive
    "🚀 ⭐ 💡", // Emoji only
    "Что это такое?", // Non-English
    "SELECT * FROM tools", // SQL injection attempt
    "<script>alert('test')</script>", // XSS attempt
  ];

  static readonly STRESS_TEST_QUERIES = Array(100).fill(0).map((_, i) => 
    `test query number ${i} for stress testing performance`
  );

  static generateBatchTestData(size: number): Array<{ id: string; name: string }> {
    const baseQueries = Object.keys(this.GROUND_TRUTH_MAPPINGS);
    return Array(size).fill(0).map((_, i) => ({
      id: `task-${i}`,
      name: baseQueries[i % baseQueries.length]
    }));
  }

  static getUserPreferences(variant: 'free' | 'premium' | 'enterprise' = 'free') {
    switch (variant) {
      case 'free':
        return { budget_range: 'free', categories: ['productivity', 'design'] };
      case 'premium':
        return { budget_range: 'paid', categories: ['development', 'analytics'] };
      case 'enterprise':
        return { budget_range: 'enterprise', categories: ['collaboration', 'security'] };
      default:
        return {};
    }
  }
}

/**
 * Accuracy Testing Suite
 */
export class AccuracyTestSuite {
  
  /**
   * Calculate precision, recall, and F1 score for recommendations
   */
  static calculateAccuracyMetrics(
    predictedTools: string[],
    expectedTools: string[],
    confidenceScores: number[] = []
  ): AccuracyMetrics {
    if (expectedTools.length === 0) {
      return {
        precision: 0,
        recall: 0,
        f1Score: 0,
        meanReciprocalRank: 0,
        ndcg: 0,
        confidenceScore: confidenceScores.length > 0 ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length : 0,
        coverageScore: 0
      };
    }

    const predictedSet = new Set(predictedTools.map(t => t.toLowerCase()));
    const expectedSet = new Set(expectedTools.map(t => t.toLowerCase()));
    
    const truePositives = [...predictedSet].filter(tool => expectedSet.has(tool)).length;
    const falsePositives = predictedTools.length - truePositives;
    const falseNegatives = expectedTools.length - truePositives;
    
    const precision = predictedTools.length > 0 ? truePositives / predictedTools.length : 0;
    const recall = truePositives / expectedTools.length;
    const f1Score = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    
    // Calculate Mean Reciprocal Rank
    let mrr = 0;
    for (let i = 0; i < predictedTools.length; i++) {
      if (expectedSet.has(predictedTools[i].toLowerCase())) {
        mrr = 1 / (i + 1);
        break;
      }
    }
    
    // Calculate NDCG@k (simplified version)
    let dcg = 0;
    let idcg = 0;
    for (let i = 0; i < Math.min(predictedTools.length, expectedTools.length); i++) {
      const relevance = expectedSet.has(predictedTools[i]?.toLowerCase()) ? 1 : 0;
      dcg += relevance / Math.log2(i + 2);
      idcg += 1 / Math.log2(i + 2); // Ideal ranking
    }
    const ndcg = idcg > 0 ? dcg / idcg : 0;
    
    const confidenceScore = confidenceScores.length > 0 
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length 
      : 0;
    
    const coverageScore = truePositives / expectedTools.length;
    
    return {
      precision,
      recall,
      f1Score,
      meanReciprocalRank: mrr,
      ndcg,
      confidenceScore,
      coverageScore
    };
  }

  /**
   * Compare RAG vs Legacy recommendation accuracy
   */
  static async compareRecommendationAccuracy(): Promise<TestResult> {
    const testName = "RAG vs Legacy Recommendation Accuracy";
    const startTime = Date.now();
    
    try {
      const testResults = [];
      let totalAccuracyImprovement = 0;

      for (const [query, expectedTools] of Object.entries(TestDataFactory.GROUND_TRUTH_MAPPINGS)) {
        if (expectedTools.length === 0) continue; // Skip edge cases for accuracy testing

        // Get RAG-enhanced recommendations
        const ragResults = await getRelevantToolsWithRAG(query, 3, undefined, {
          enableRAG: true,
          enableAdaptive: true,
          fallbackStrategy: [SearchStrategy.RAG_ENHANCED, SearchStrategy.ADAPTIVE, SearchStrategy.HYBRID]
        });

        // Get legacy recommendations
        const legacyResults = await getRelevantTools(query, 3);

        // Extract tool names
        const ragToolNames = ragResults.map(r => r.metadata.name);
        const legacyToolNames = legacyResults.map(r => r.metadata.name);
        const ragConfidences = ragResults.map(r => r.metadata.confidence_score || 0.5);

        // Calculate metrics
        const ragMetrics = this.calculateAccuracyMetrics(ragToolNames, expectedTools, ragConfidences);
        const legacyMetrics = this.calculateAccuracyMetrics(legacyToolNames, expectedTools);

        const improvement = ragMetrics.f1Score - legacyMetrics.f1Score;
        totalAccuracyImprovement += improvement;

        testResults.push({
          query,
          expected: expectedTools,
          rag: { tools: ragToolNames, metrics: ragMetrics },
          legacy: { tools: legacyToolNames, metrics: legacyMetrics },
          improvement
        });
      }

      const avgAccuracyImprovement = totalAccuracyImprovement / testResults.length;
      const passed = avgAccuracyImprovement > 0.1; // At least 10% improvement expected

      return {
        testName,
        passed,
        score: avgAccuracyImprovement,
        executionTime: Date.now() - startTime,
        details: {
          avgAccuracyImprovement,
          totalQueriesTested: testResults.length,
          results: testResults,
          summary: {
            significantImprovements: testResults.filter(r => r.improvement > 0.2).length,
            regressions: testResults.filter(r => r.improvement < -0.1).length
          }
        }
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        executionTime: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test recommendation relevance across different task types
   */
  static async testRecommendationRelevance(): Promise<TestResult> {
    const testName = "Recommendation Relevance by Task Type";
    const startTime = Date.now();
    
    try {
      const taskTypeQueries = {
        [TaskType.DESIGN]: ["Create UI mockups", "Design website layout", "Make logo"],
        [TaskType.CODING]: ["Write Python script", "Debug JavaScript", "Build REST API"],
        [TaskType.ANALYSIS]: ["Analyze sales data", "Create dashboard", "Process datasets"],
        [TaskType.COMMUNICATION]: ["Set up team chat", "Schedule meetings", "Share files"]
      };

      const results = [];
      let totalRelevanceScore = 0;

      for (const [taskType, queries] of Object.entries(taskTypeQueries)) {
        for (const query of queries) {
          const recommendation = await smartRecommendationEngine.getSmartRecommendationWithRAG(
            query,
            undefined,
            { sessionId: `test-${Date.now()}`, language: "en" },
            { enableRAG: true, enableAdaptive: true }
          );

          const detectedTaskType = smartRecommendationEngine.detectTaskType(query);
          const taskTypeMatch = detectedTaskType === taskType;
          const hasRecommendation = recommendation.toolId !== null;
          const highConfidence = recommendation.confidenceScore > 0.7;

          const relevanceScore = (taskTypeMatch ? 0.4 : 0) + 
                                 (hasRecommendation ? 0.4 : 0) + 
                                 (highConfidence ? 0.2 : 0);

          totalRelevanceScore += relevanceScore;
          results.push({
            query,
            expectedTaskType: taskType,
            detectedTaskType,
            taskTypeMatch,
            recommendation: recommendation.toolName,
            confidenceScore: recommendation.confidenceScore,
            relevanceScore
          });
        }
      }

      const avgRelevanceScore = totalRelevanceScore / results.length;
      const passed = avgRelevanceScore > 0.7;

      return {
        testName,
        passed,
        score: avgRelevanceScore,
        executionTime: Date.now() - startTime,
        details: {
          avgRelevanceScore,
          results,
          summary: {
            highRelevance: results.filter(r => r.relevanceScore > 0.8).length,
            mediumRelevance: results.filter(r => r.relevanceScore > 0.5 && r.relevanceScore <= 0.8).length,
            lowRelevance: results.filter(r => r.relevanceScore <= 0.5).length
          }
        }
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        executionTime: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

/**
 * Performance Testing Suite
 */
export class PerformanceTestSuite {
  
  /**
   * Test search response time under normal load
   */
  static async testSearchPerformance(): Promise<TestResult> {
    const testName = "Search Performance Test";
    const startTime = Date.now();
    
    try {
      const searchTimes = [];
      const queries = TestDataFactory.PERFORMANCE_TEST_QUERIES;

      for (const query of queries) {
        const queryStartTime = Date.now();
        
        await getRelevantToolsWithRAG(query, 5, undefined, {
          enableRAG: true,
          enableAdaptive: true
        });
        
        const queryTime = Date.now() - queryStartTime;
        searchTimes.push(queryTime);
      }

      const avgSearchTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
      const maxSearchTime = Math.max(...searchTimes);
      const minSearchTime = Math.min(...searchTimes);
      
      // Performance requirements: avg < 500ms, max < 1000ms
      const passed = avgSearchTime < 500 && maxSearchTime < 1000;

      return {
        testName,
        passed,
        score: Math.max(0, (1000 - avgSearchTime) / 1000), // Score based on how much under 1s
        executionTime: Date.now() - startTime,
        details: {
          avgSearchTime,
          maxSearchTime,
          minSearchTime,
          searchTimes,
          queriesPerSecond: 1000 / avgSearchTime,
          performanceGrade: avgSearchTime < 200 ? 'A' : avgSearchTime < 500 ? 'B' : 'C'
        }
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        executionTime: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test recommendation engine performance under load
   */
  static async testRecommendationEnginePerformance(): Promise<TestResult> {
    const testName = "Recommendation Engine Performance";
    const startTime = Date.now();
    
    try {
      const performanceMetrics = [];
      const queries = TestDataFactory.PERFORMANCE_TEST_QUERIES;

      for (const query of queries) {
        const recommendation = await smartRecommendationEngine.getSmartRecommendationWithRAG(
          query,
          TestDataFactory.getUserPreferences(),
          { sessionId: `perf-test-${Date.now()}`, language: "en" },
          { enableRAG: true, enableAdaptive: true }
        );

        performanceMetrics.push({
          query,
          searchDuration: recommendation.searchDuration,
          rerankingDuration: recommendation.rerankingDuration,
          totalDuration: recommendation.searchDuration + recommendation.rerankingDuration,
          success: !!recommendation.toolId
        });
      }

      const avgTotalTime = performanceMetrics.reduce((sum, m) => sum + m.totalDuration, 0) / performanceMetrics.length;
      const avgSearchTime = performanceMetrics.reduce((sum, m) => sum + m.searchDuration, 0) / performanceMetrics.length;
      const avgRerankingTime = performanceMetrics.reduce((sum, m) => sum + m.rerankingDuration, 0) / performanceMetrics.length;
      const successRate = performanceMetrics.filter(m => m.success).length / performanceMetrics.length;

      // Performance requirements: total < 800ms, success rate > 90%
      const passed = avgTotalTime < 800 && successRate > 0.9;

      return {
        testName,
        passed,
        score: Math.min(successRate, (1000 - avgTotalTime) / 1000),
        executionTime: Date.now() - startTime,
        details: {
          avgTotalTime,
          avgSearchTime,
          avgRerankingTime,
          successRate,
          throughput: 1000 / avgTotalTime,
          metrics: performanceMetrics
        }
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        executionTime: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Stress test with concurrent requests
   */
  static async testConcurrentLoad(): Promise<TestResult> {
    const testName = "Concurrent Load Stress Test";
    const startTime = Date.now();
    
    try {
      const concurrentRequests = 20;
      const queries = TestDataFactory.STRESS_TEST_QUERIES.slice(0, concurrentRequests);
      
      const promises = queries.map(async (query, index) => {
        const requestStartTime = Date.now();
        try {
          const result = await smartRecommendationEngine.getSmartRecommendationWithRAG(
            query,
            TestDataFactory.getUserPreferences(),
            { sessionId: `stress-test-${index}`, language: "en" },
            { enableRAG: true, enableAdaptive: true }
          );
          return {
            success: true,
            duration: Date.now() - requestStartTime,
            hasResult: !!result.toolId
          };
        } catch (error) {
          return {
            success: false,
            duration: Date.now() - requestStartTime,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });

      const results = await Promise.all(promises);
      const successfulRequests = results.filter(r => r.success);
      const failedRequests = results.filter(r => !r.success);
      
      const successRate = successfulRequests.length / results.length;
      const avgDuration = successfulRequests.reduce((sum, r) => sum + r.duration, 0) / successfulRequests.length;
      const maxDuration = Math.max(...results.map(r => r.duration));

      // Stress test requirements: success rate > 85%, avg duration < 1500ms
      const passed = successRate > 0.85 && avgDuration < 1500;

      return {
        testName,
        passed,
        score: successRate * Math.min(1, 1500 / avgDuration),
        executionTime: Date.now() - startTime,
        details: {
          concurrentRequests,
          successRate,
          avgDuration,
          maxDuration,
          failedRequests: failedRequests.length,
          systemThroughput: concurrentRequests / (maxDuration / 1000)
        }
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        executionTime: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

/**
 * Integration Testing Suite
 */
export class IntegrationTestSuite {
  
  /**
   * Test complete pipeline from query to recommendation
   */
  static async testEndToEndPipeline(): Promise<TestResult> {
    const testName = "End-to-End Pipeline Integration";
    const startTime = Date.now();
    
    try {
      const testQuery = "Create dashboard for sales analytics";
      const userPreferences = TestDataFactory.getUserPreferences('premium');
      const userContext = { sessionId: `e2e-test-${Date.now()}`, language: "en" };

      // Step 1: Query type detection
      const queryType = detectQueryType(testQuery);
      
      // Step 2: RAG knowledge base check
      const ragStats = await getRagKnowledgeStats();
      
      // Step 3: Vector search with RAG enhancement
      const searchResults = await getRelevantToolsWithRAG(testQuery, 5, userPreferences, {
        enableRAG: true,
        enableAdaptive: true,
        fallbackStrategy: [SearchStrategy.RAG_ENHANCED, SearchStrategy.ADAPTIVE, SearchStrategy.HYBRID]
      });
      
      // Step 4: Smart recommendation with reranking
      const recommendation = await smartRecommendationEngine.getSmartRecommendationWithRAG(
        testQuery,
        userPreferences,
        userContext,
        { enableRAG: true, enableAdaptive: true }
      );

      // Validate pipeline steps
      const validations = {
        queryTypeDetected: queryType !== undefined,
        ragStatsAvailable: ragStats !== null,
        searchResultsReturned: searchResults.length > 0,
        recommendationGenerated: recommendation.toolId !== null,
        confidenceScoreValid: recommendation.confidenceScore > 0 && recommendation.confidenceScore <= 1,
        taskTypeDetected: recommendation.taskType !== undefined,
        performanceAcceptable: recommendation.searchDuration + recommendation.rerankingDuration < 1000
      };

      const passedValidations = Object.values(validations).filter(Boolean).length;
      const totalValidations = Object.keys(validations).length;
      const passed = passedValidations === totalValidations;

      return {
        testName,
        passed,
        score: passedValidations / totalValidations,
        executionTime: Date.now() - startTime,
        details: {
          testQuery,
          queryType,
          ragStats: ragStats ? {
            totalEntries: ragStats.total_knowledge_entries,
            qualityScore: ragStats.knowledge_quality_score
          } : null,
          searchResults: searchResults.length,
          recommendation: {
            toolName: recommendation.toolName,
            confidenceScore: recommendation.confidenceScore,
            taskType: recommendation.taskType,
            searchStrategy: (recommendation as any).searchStrategy
          },
          validations,
          pipelinePerformance: {
            searchDuration: recommendation.searchDuration,
            rerankingDuration: recommendation.rerankingDuration,
            totalDuration: recommendation.searchDuration + recommendation.rerankingDuration
          }
        }
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        executionTime: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test batch processing integration
   */
  static async testBatchProcessingIntegration(): Promise<TestResult> {
    const testName = "Batch Processing Integration";
    const startTime = Date.now();
    
    try {
      const testTasks = TestDataFactory.generateBatchTestData(10);
      const userPreferences = TestDataFactory.getUserPreferences();
      const userContext = { sessionId: `batch-test-${Date.now()}`, language: "en" };

      const batchResults = await smartRecommendationEngine.processTasksInParallelWithRAG(
        testTasks,
        userPreferences,
        userContext,
        `workflow-${Date.now()}`,
        { enableRAG: true, enableAdaptive: true }
      );

      const successfulRecommendations = batchResults.filter(r => r.toolId !== null);
      const avgConfidenceScore = successfulRecommendations.reduce((sum, r) => sum + r.confidenceScore, 0) / successfulRecommendations.length;
      const avgProcessingTime = batchResults.reduce((sum, r) => sum + r.searchDuration + r.rerankingDuration, 0) / batchResults.length;

      const validations = {
        allTasksProcessed: batchResults.length === testTasks.length,
        highSuccessRate: successfulRecommendations.length / batchResults.length > 0.8,
        reasonablePerformance: avgProcessingTime < 1000,
        goodConfidence: avgConfidenceScore > 0.5
      };

      const passed = Object.values(validations).every(Boolean);

      return {
        testName,
        passed,
        score: successfulRecommendations.length / batchResults.length,
        executionTime: Date.now() - startTime,
        details: {
          totalTasks: testTasks.length,
          successfulRecommendations: successfulRecommendations.length,
          avgConfidenceScore,
          avgProcessingTime,
          validations,
          strategyUsage: batchResults.reduce((acc, result) => {
            const strategy = (result as any).searchStrategy || 'unknown';
            acc[strategy] = (acc[strategy] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        executionTime: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test fallback mechanisms
   */
  static async testFallbackMechanisms(): Promise<TestResult> {
    const testName = "Fallback Mechanisms Test";
    const startTime = Date.now();
    
    try {
      const testQuery = "project management tool";
      const fallbackScenarios = [
        {
          name: "RAG disabled fallback",
          options: { enableRAG: false, enableAdaptive: true, fallbackToLegacy: true }
        },
        {
          name: "Adaptive disabled fallback", 
          options: { enableRAG: true, enableAdaptive: false, fallbackToLegacy: true }
        },
        {
          name: "Full fallback to legacy",
          options: { enableRAG: false, enableAdaptive: false, fallbackToLegacy: true }
        }
      ];

      const scenarioResults = [];
      
      for (const scenario of fallbackScenarios) {
        try {
          const result = await smartRecommendationEngine.getSmartRecommendationWithRAG(
            testQuery,
            undefined,
            { sessionId: `fallback-test-${Date.now()}`, language: "en" },
            scenario.options
          );

          scenarioResults.push({
            scenario: scenario.name,
            success: result.toolId !== null,
            strategy: (result as any).searchStrategy,
            confidenceScore: result.confidenceScore,
            duration: result.searchDuration + result.rerankingDuration
          });
        } catch (error) {
          scenarioResults.push({
            scenario: scenario.name,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const successfulFallbacks = scenarioResults.filter(r => r.success).length;
      const passed = successfulFallbacks === fallbackScenarios.length;

      return {
        testName,
        passed,
        score: successfulFallbacks / fallbackScenarios.length,
        executionTime: Date.now() - startTime,
        details: {
          scenarioResults,
          successfulFallbacks,
          totalScenarios: fallbackScenarios.length
        }
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        executionTime: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

/**
 * Edge Case Testing Suite
 */
export class EdgeCaseTestSuite {
  
  /**
   * Test handling of various edge case queries
   */
  static async testEdgeCaseQueries(): Promise<TestResult> {
    const testName = "Edge Case Query Handling";
    const startTime = Date.now();
    
    try {
      const edgeCaseResults = [];

      for (const query of TestDataFactory.EDGE_CASE_QUERIES) {
        try {
          const result = await smartRecommendationEngine.getSmartRecommendationWithRAG(
            query,
            undefined,
            { sessionId: `edge-case-${Date.now()}`, language: "en" },
            { enableRAG: true, enableAdaptive: true, fallbackToLegacy: true }
          );

          edgeCaseResults.push({
            query: query.substring(0, 50),
            handled: true,
            hasRecommendation: result.toolId !== null,
            confidenceScore: result.confidenceScore,
            reason: result.reason.substring(0, 100),
            duration: result.searchDuration + result.rerankingDuration
          });
        } catch (error) {
          edgeCaseResults.push({
            query: query.substring(0, 50),
            handled: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const handledCases = edgeCaseResults.filter(r => r.handled).length;
      const gracefulHandling = edgeCaseResults.filter(r => r.handled && !r.hasRecommendation).length; // Should gracefully return no results
      
      // Edge cases should be handled gracefully (not crash) even if no recommendation is made
      const passed = handledCases === TestDataFactory.EDGE_CASE_QUERIES.length;

      return {
        testName,
        passed,
        score: handledCases / TestDataFactory.EDGE_CASE_QUERIES.length,
        executionTime: Date.now() - startTime,
        details: {
          totalEdgeCases: TestDataFactory.EDGE_CASE_QUERIES.length,
          handledCases,
          gracefulHandling,
          results: edgeCaseResults
        }
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        executionTime: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test error handling and recovery
   */
  static async testErrorHandlingAndRecovery(): Promise<TestResult> {
    const testName = "Error Handling and Recovery";
    const startTime = Date.now();
    
    try {
      // Test circuit breaker functionality
      const errorStats = ragErrorHandler.getFailureStats();
      
      // Test with malformed preferences
      let malformedPrefsTest = false;
      try {
        await smartRecommendationEngine.getSmartRecommendationWithRAG(
          "test query",
          { invalid: "preferences" },
          { sessionId: "error-test", language: "en" }
        );
        malformedPrefsTest = true;
      } catch (error) {
        // Should handle gracefully or with proper error
        malformedPrefsTest = error instanceof Error && !error.message.includes("Unhandled");
      }

      // Test with empty context
      let emptyContextTest = false;
      try {
        await smartRecommendationEngine.getSmartRecommendationWithRAG(
          "test query",
          undefined,
          {} as any
        );
        emptyContextTest = true;
      } catch (error) {
        emptyContextTest = error instanceof Error && !error.message.includes("Unhandled");
      }

      const validations = {
        circuitBreakerAvailable: typeof errorStats === 'object',
        malformedPrefsHandled: malformedPrefsTest,
        emptyContextHandled: emptyContextTest
      };

      const passed = Object.values(validations).every(Boolean);

      return {
        testName,
        passed,
        score: Object.values(validations).filter(Boolean).length / Object.keys(validations).length,
        executionTime: Date.now() - startTime,
        details: {
          validations,
          errorStats,
          errorHandlingTests: {
            malformedPrefsTest,
            emptyContextTest
          }
        }
      };
    } catch (error) {
      return {
        testName,
        passed: false,
        executionTime: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

/**
 * Master Test Suite Runner
 */
export class RagTestSuiteRunner {
  
  private static testResults: TestResult[] = [];

  /**
   * Run all test suites and generate comprehensive report
   */
  static async runComprehensiveTestSuite(): Promise<{
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      overallScore: number;
      executionTime: number;
    };
    results: TestResult[];
    report: string;
  }> {
    const suiteStartTime = Date.now();
    console.log("🧪 Starting RAG-Enhanced Tool Matching Comprehensive Test Suite");
    console.log("=" .repeat(80));

    this.testResults = [];

    // Accuracy Tests
    console.log("\n📊 Running Accuracy Tests...");
    this.testResults.push(await AccuracyTestSuite.compareRecommendationAccuracy());
    this.testResults.push(await AccuracyTestSuite.testRecommendationRelevance());

    // Performance Tests
    console.log("\n⚡ Running Performance Tests...");
    this.testResults.push(await PerformanceTestSuite.testSearchPerformance());
    this.testResults.push(await PerformanceTestSuite.testRecommendationEnginePerformance());
    this.testResults.push(await PerformanceTestSuite.testConcurrentLoad());

    // Integration Tests
    console.log("\n🔗 Running Integration Tests...");
    this.testResults.push(await IntegrationTestSuite.testEndToEndPipeline());
    this.testResults.push(await IntegrationTestSuite.testBatchProcessingIntegration());
    this.testResults.push(await IntegrationTestSuite.testFallbackMechanisms());

    // Edge Case Tests
    console.log("\n🎯 Running Edge Case Tests...");
    this.testResults.push(await EdgeCaseTestSuite.testEdgeCaseQueries());
    this.testResults.push(await EdgeCaseTestSuite.testErrorHandlingAndRecovery());

    const totalExecutionTime = Date.now() - suiteStartTime;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = this.testResults.filter(r => !r.passed).length;
    const overallScore = this.testResults.reduce((sum, r) => sum + (r.score || 0), 0) / this.testResults.length;

    const summary = {
      totalTests: this.testResults.length,
      passedTests,
      failedTests,
      overallScore,
      executionTime: totalExecutionTime
    };

    const report = this.generateDetailedReport(summary);

    console.log("\n" + "=" .repeat(80));
    console.log("🏁 RAG-Enhanced Test Suite Completed");
    console.log(report);

    return {
      summary,
      results: this.testResults,
      report
    };
  }

  /**
   * Generate a detailed test report
   */
  private static generateDetailedReport(summary: any): string {
    const lines = [];
    
    lines.push(`\n📋 TEST SUITE SUMMARY`);
    lines.push(`Total Tests: ${summary.totalTests}`);
    lines.push(`Passed: ${summary.passedTests} ✓`);
    lines.push(`Failed: ${summary.failedTests} ${summary.failedTests > 0 ? '✗' : ''}`);
    lines.push(`Overall Score: ${(summary.overallScore * 100).toFixed(1)}%`);
    lines.push(`Execution Time: ${summary.executionTime}ms`);
    lines.push(`Success Rate: ${((summary.passedTests / summary.totalTests) * 100).toFixed(1)}%`);

    lines.push(`\n🔍 DETAILED RESULTS:`);
    
    // Group results by category
    const categories = {
      'Accuracy Tests': this.testResults.filter(r => r.testName.includes('Accuracy') || r.testName.includes('Relevance')),
      'Performance Tests': this.testResults.filter(r => r.testName.includes('Performance') || r.testName.includes('Load')),
      'Integration Tests': this.testResults.filter(r => r.testName.includes('Integration') || r.testName.includes('Pipeline') || r.testName.includes('Fallback')),
      'Edge Case Tests': this.testResults.filter(r => r.testName.includes('Edge') || r.testName.includes('Error'))
    };

    for (const [category, tests] of Object.entries(categories)) {
      if (tests.length === 0) continue;
      
      lines.push(`\n${category}:`);
      tests.forEach(test => {
        const status = test.passed ? '✓' : '✗';
        const score = test.score !== undefined ? ` (${(test.score * 100).toFixed(1)}%)` : '';
        const time = ` [${test.executionTime}ms]`;
        lines.push(`  ${status} ${test.testName}${score}${time}`);
        
        if (!test.passed && test.error) {
          lines.push(`    Error: ${test.error}`);
        }
      });
    }

    lines.push(`\n🎯 RECOMMENDATIONS:`);
    
    if (summary.failedTests > 0) {
      lines.push(`• Address ${summary.failedTests} failing test(s)`);
    }
    
    if (summary.overallScore < 0.8) {
      lines.push(`• Overall score (${(summary.overallScore * 100).toFixed(1)}%) needs improvement`);
    } else if (summary.overallScore >= 0.9) {
      lines.push(`• Excellent performance! System is ready for production`);
    } else {
      lines.push(`• Good performance, consider minor optimizations`);
    }

    // Performance recommendations
    const perfTests = this.testResults.filter(r => r.testName.includes('Performance'));
    const avgPerfScore = perfTests.reduce((sum, t) => sum + (t.score || 0), 0) / perfTests.length;
    if (avgPerfScore < 0.7) {
      lines.push(`• Performance optimization needed (avg: ${(avgPerfScore * 100).toFixed(1)}%)`);
    }

    // Accuracy recommendations
    const accTests = this.testResults.filter(r => r.testName.includes('Accuracy'));
    const avgAccScore = accTests.reduce((sum, t) => sum + (t.score || 0), 0) / accTests.length;
    if (avgAccScore < 0.1) {
      lines.push(`• RAG enhancement may need tuning (accuracy improvement: ${(avgAccScore * 100).toFixed(1)}%)`);
    } else if (avgAccScore > 0.2) {
      lines.push(`• RAG enhancement is providing significant value! (improvement: ${(avgAccScore * 100).toFixed(1)}%)`);
    }

    return lines.join('\n');
  }

  /**
   * Run specific test category
   */
  static async runTestCategory(category: 'accuracy' | 'performance' | 'integration' | 'edge-cases'): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    switch (category) {
      case 'accuracy':
        results.push(await AccuracyTestSuite.compareRecommendationAccuracy());
        results.push(await AccuracyTestSuite.testRecommendationRelevance());
        break;
      
      case 'performance':
        results.push(await PerformanceTestSuite.testSearchPerformance());
        results.push(await PerformanceTestSuite.testRecommendationEnginePerformance());
        results.push(await PerformanceTestSuite.testConcurrentLoad());
        break;
      
      case 'integration':
        results.push(await IntegrationTestSuite.testEndToEndPipeline());
        results.push(await IntegrationTestSuite.testBatchProcessingIntegration());
        results.push(await IntegrationTestSuite.testFallbackMechanisms());
        break;
      
      case 'edge-cases':
        results.push(await EdgeCaseTestSuite.testEdgeCaseQueries());
        results.push(await EdgeCaseTestSuite.testErrorHandlingAndRecovery());
        break;
    }
    
    return results;
  }
}

// Export the main test runner for external use
export default RagTestSuiteRunner;