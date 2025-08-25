/**
 * Comprehensive Regression Testing Framework for RAG Enhancement
 * 
 * Ensures that RAG enhancements don't break existing functionality and
 * maintains backward compatibility while improving system capabilities.
 * 
 * Key Testing Areas:
 * - API compatibility and response formats
 * - Legacy query handling and response quality
 * - Performance regression detection  
 * - Data integrity and consistency
 * - User workflow preservation
 * - Error handling and edge cases
 */

import { smartRecommendationEngine } from "@/lib/services/smart-recommendation-service";
import { getRelevantTools, getRelevantToolsWithRAG } from "@/lib/supabase/vector-store";
import { logger } from "@/lib/logger/structured-logger";

export interface RegressionTestResult {
  testName: string;
  category: 'api-compatibility' | 'functionality' | 'performance' | 'data-integrity';
  passed: boolean;
  score: number; // 0-1 scale
  executionTime: number;
  baselineComparison?: {
    current: any;
    baseline: any;
    deviation: number;
  };
  details: any;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations?: string[];
}

export interface RegressionTestSuite {
  name: string;
  description: string;
  tests: RegressionTestResult[];
  overallPassed: boolean;
  overallScore: number;
  riskAssessment: string;
  blockingIssues: string[];
  warnings: string[];
}

/**
 * API Compatibility Regression Tests
 */
export class ApiCompatibilityTests {
  
  static async runApiCompatibilityTests(): Promise<RegressionTestResult[]> {
    console.log("🔧 Running API Compatibility Regression Tests");
    
    const tests = [
      this.testSmartRecommendApiCompatibility(),
      this.testBatchProcessingApiCompatibility(),
      this.testLegacyRecommendApiCompatibility(),
      this.testResponseFormatConsistency(),
      this.testErrorResponseCompatibility()
    ];

    return await Promise.all(tests);
  }

  private static async testSmartRecommendApiCompatibility(): Promise<RegressionTestResult> {
    const testName = "Smart Recommend API Compatibility";
    const startTime = Date.now();
    
    try {
      // Test with legacy parameters (should still work)
      const legacyRequest = {
        taskName: "design tool",
        preferences: { categories: ["design"], budget_range: "free" },
        language: "en"
      };

      const result = await smartRecommendationEngine.getSmartRecommendation(
        legacyRequest.taskName,
        legacyRequest.preferences,
        { sessionId: `regression-${Date.now()}`, language: legacyRequest.language }
      );

      // Validate response structure matches expected format
      const hasRequiredFields = !!(
        result.toolId && 
        typeof result.confidenceScore === 'number' &&
        result.reason && 
        result.taskType
      );

      const performanceAcceptable = (Date.now() - startTime) < 2000; // 2s max
      const validConfidenceRange = result.confidenceScore >= 0 && result.confidenceScore <= 1;

      const passed = hasRequiredFields && performanceAcceptable && validConfidenceRange;

      return {
        testName,
        category: 'api-compatibility',
        passed,
        score: passed ? 1.0 : 0.6,
        executionTime: Date.now() - startTime,
        details: {
          hasRequiredFields,
          performanceAcceptable,
          validConfidenceRange,
          responseStructure: Object.keys(result),
          actualResponseTime: Date.now() - startTime
        },
        riskLevel: passed ? 'low' : 'medium',
        recommendations: passed ? [] : [
          'Verify API response structure compatibility',
          'Check performance regression in smart recommendation',
          'Validate confidence score calculation'
        ]
      };

    } catch (error) {
      return {
        testName,
        category: 'api-compatibility',
        passed: false,
        score: 0,
        executionTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) },
        riskLevel: 'critical',
        recommendations: ['Fix critical API compatibility issue before deployment']
      };
    }
  }

  private static async testBatchProcessingApiCompatibility(): Promise<RegressionTestResult> {
    const testName = "Batch Processing API Compatibility";
    const startTime = Date.now();
    
    try {
      const batchTasks = [
        { id: "task-1", name: "Create dashboard" },
        { id: "task-2", name: "Design mockup" },
        { id: "task-3", name: "Code review tool" }
      ];

      const results = await smartRecommendationEngine.processTasksInParallel(
        batchTasks,
        { categories: ["analytics", "design", "development"] },
        { sessionId: `batch-regression-${Date.now()}`, language: "en" },
        `workflow-${Date.now()}`
      );

      // Validate batch response format
      const correctLength = results.length === batchTasks.length;
      const allHaveRequiredFields = results.every(r => 
        r.taskId && r.toolId && typeof r.confidenceScore === 'number'
      );
      const performanceAcceptable = (Date.now() - startTime) < 5000; // 5s max for batch

      const passed = correctLength && allHaveRequiredFields && performanceAcceptable;

      return {
        testName,
        category: 'api-compatibility',
        passed,
        score: passed ? 1.0 : 0.5,
        executionTime: Date.now() - startTime,
        details: {
          inputTasks: batchTasks.length,
          outputResults: results.length,
          correctLength,
          allHaveRequiredFields,
          performanceAcceptable,
          batchProcessingTime: Date.now() - startTime
        },
        riskLevel: passed ? 'low' : 'high'
      };

    } catch (error) {
      return {
        testName,
        category: 'api-compatibility',
        passed: false,
        score: 0,
        executionTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) },
        riskLevel: 'critical'
      };
    }
  }

  private static async testLegacyRecommendApiCompatibility(): Promise<RegressionTestResult> {
    const testName = "Legacy Recommend API Compatibility";
    const startTime = Date.now();
    
    try {
      // Test the basic vector search that should still work
      const results = await getRelevantTools("project management tool", 5);
      
      const hasResults = results.length > 0;
      const correctStructure = results.every(r => 
        r.metadata && r.metadata.name && r.metadata.id
      );
      const performanceAcceptable = (Date.now() - startTime) < 1000;

      const passed = hasResults && correctStructure && performanceAcceptable;

      return {
        testName,
        category: 'api-compatibility',
        passed,
        score: passed ? 1.0 : 0.7,
        executionTime: Date.now() - startTime,
        details: {
          hasResults,
          correctStructure,
          performanceAcceptable,
          resultCount: results.length,
          sampleResult: results[0]?.metadata
        },
        riskLevel: passed ? 'low' : 'medium'
      };

    } catch (error) {
      return {
        testName,
        category: 'api-compatibility', 
        passed: false,
        score: 0,
        executionTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) },
        riskLevel: 'high'
      };
    }
  }

  private static async testResponseFormatConsistency(): Promise<RegressionTestResult> {
    const testName = "Response Format Consistency";
    const startTime = Date.now();
    
    try {
      // Test multiple queries to ensure response format consistency
      const testQueries = ["design tool", "analytics platform", "code editor"];
      const responses = [];

      for (const query of testQueries) {
        const result = await smartRecommendationEngine.getSmartRecommendation(
          query,
          undefined,
          { sessionId: `format-test-${Date.now()}`, language: "en" }
        );
        responses.push(result);
      }

      // Check format consistency
      const responseKeys = responses.map(r => Object.keys(r).sort());
      const firstFormat = responseKeys[0];
      const formatConsistent = responseKeys.every(keys => 
        keys.length === firstFormat.length && 
        keys.every((key, index) => key === firstFormat[index])
      );

      const dataTypesConsistent = responses.every(r => 
        typeof r.confidenceScore === 'number' &&
        typeof r.toolId === 'string' &&
        typeof r.reason === 'string'
      );

      const passed = formatConsistent && dataTypesConsistent;

      return {
        testName,
        category: 'api-compatibility',
        passed,
        score: passed ? 1.0 : 0.4,
        executionTime: Date.now() - startTime,
        details: {
          formatConsistent,
          dataTypesConsistent,
          sampleFormats: responseKeys,
          queriesTested: testQueries.length
        },
        riskLevel: passed ? 'low' : 'high',
        recommendations: passed ? [] : [
          'Standardize response format across all endpoints',
          'Implement response validation middleware',
          'Add API versioning if format changes are needed'
        ]
      };

    } catch (error) {
      return {
        testName,
        category: 'api-compatibility',
        passed: false,
        score: 0,
        executionTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) },
        riskLevel: 'critical'
      };
    }
  }

  private static async testErrorResponseCompatibility(): Promise<RegressionTestResult> {
    const testName = "Error Response Compatibility";
    const startTime = Date.now();
    
    try {
      const errorTestCases = [
        { case: "empty query", input: "" },
        { case: "null preferences", input: "test", preferences: null as any },
        { case: "malformed context", input: "test", context: {} as any }
      ];

      const errorResponses = [];
      
      for (const testCase of errorTestCases) {
        try {
          await smartRecommendationEngine.getSmartRecommendation(
            testCase.input,
            testCase.preferences,
            testCase.context || { sessionId: "error-test", language: "en" }
          );
          errorResponses.push({ case: testCase.case, handled: false });
        } catch (error) {
          // Expected behavior - errors should be handled gracefully
          errorResponses.push({ 
            case: testCase.case, 
            handled: true,
            errorType: error instanceof Error ? error.constructor.name : 'Unknown',
            hasMessage: !!(error instanceof Error && error.message)
          });
        }
      }

      const allErrorsHandled = errorResponses.every(r => r.handled);
      const errorsHaveMessages = errorResponses.every(r => r.hasMessage !== false);

      const passed = allErrorsHandled && errorsHaveMessages;

      return {
        testName,
        category: 'api-compatibility',
        passed,
        score: passed ? 1.0 : 0.5,
        executionTime: Date.now() - startTime,
        details: {
          errorResponses,
          allErrorsHandled,
          errorsHaveMessages,
          testCasesCount: errorTestCases.length
        },
        riskLevel: passed ? 'low' : 'medium'
      };

    } catch (error) {
      return {
        testName,
        category: 'api-compatibility',
        passed: false,
        score: 0,
        executionTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) },
        riskLevel: 'medium'
      };
    }
  }
}

/**
 * Functionality Regression Tests
 */
export class FunctionalityRegressionTests {
  
  static async runFunctionalityTests(): Promise<RegressionTestResult[]> {
    console.log("⚙️ Running Functionality Regression Tests");
    
    const tests = [
      this.testBasicQueryHandling(),
      this.testRecommendationQuality(),
      this.testCategoryRecognition(),
      this.testUserPreferencesHandling(),
      this.testWorkflowIntegration()
    ];

    return await Promise.all(tests);
  }

  private static async testBasicQueryHandling(): Promise<RegressionTestResult> {
    const testName = "Basic Query Handling";
    const startTime = Date.now();
    
    try {
      // Test standard queries that should work reliably
      const standardQueries = [
        "design tool",
        "code editor", 
        "project management",
        "analytics platform",
        "communication tool"
      ];

      let successfulQueries = 0;
      let totalConfidence = 0;
      const queryResults = [];

      for (const query of standardQueries) {
        try {
          const result = await smartRecommendationEngine.getSmartRecommendation(
            query,
            undefined,
            { sessionId: `basic-${Date.now()}`, language: "en" }
          );

          if (result.toolId && result.confidenceScore > 0.3) {
            successfulQueries++;
          }
          totalConfidence += result.confidenceScore;
          queryResults.push({ query, success: !!result.toolId, confidence: result.confidenceScore });
        } catch (error) {
          queryResults.push({ query, success: false, error: error instanceof Error ? error.message : String(error) });
        }
      }

      const successRate = successfulQueries / standardQueries.length;
      const avgConfidence = totalConfidence / standardQueries.length;
      const passed = successRate >= 0.8 && avgConfidence >= 0.4; // 80% success rate, 40% avg confidence

      return {
        testName,
        category: 'functionality',
        passed,
        score: (successRate + avgConfidence) / 2,
        executionTime: Date.now() - startTime,
        details: {
          successRate,
          avgConfidence,
          successfulQueries,
          totalQueries: standardQueries.length,
          queryResults
        },
        riskLevel: passed ? 'low' : 'medium',
        recommendations: passed ? [] : [
          'Investigate basic query handling degradation',
          'Review confidence scoring mechanism',
          'Check knowledge base coverage for standard queries'
        ]
      };

    } catch (error) {
      return {
        testName,
        category: 'functionality',
        passed: false,
        score: 0,
        executionTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) },
        riskLevel: 'high'
      };
    }
  }

  private static async testRecommendationQuality(): Promise<RegressionTestResult> {
    const testName = "Recommendation Quality Stability";
    const startTime = Date.now();
    
    try {
      // Test queries with expected outcomes
      const qualityTestCases = [
        { query: "UI design tool", expectedCategory: "design", minConfidence: 0.5 },
        { query: "JavaScript debugger", expectedCategory: "development", minConfidence: 0.5 },
        { query: "sales analytics", expectedCategory: "analytics", minConfidence: 0.4 },
        { query: "team chat", expectedCategory: "communication", minConfidence: 0.4 }
      ];

      let qualityPassed = 0;
      const qualityResults = [];

      for (const testCase of qualityTestCases) {
        try {
          const result = await smartRecommendationEngine.getSmartRecommendation(
            testCase.query,
            undefined,
            { sessionId: `quality-${Date.now()}`, language: "en" }
          );

          const meetsMinConfidence = result.confidenceScore >= testCase.minConfidence;
          const hasRecommendation = !!result.toolId;
          const categoryMatches = result.taskType?.toLowerCase().includes(testCase.expectedCategory.toLowerCase()) ?? false;

          const qualityScore = (
            (meetsMinConfidence ? 0.4 : 0) +
            (hasRecommendation ? 0.3 : 0) +
            (categoryMatches ? 0.3 : 0)
          );

          if (qualityScore >= 0.6) qualityPassed++;

          qualityResults.push({
            query: testCase.query,
            qualityScore,
            confidence: result.confidenceScore,
            hasRecommendation,
            detectedTaskType: result.taskType,
            categoryMatches
          });

        } catch (error) {
          qualityResults.push({
            query: testCase.query,
            qualityScore: 0,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const overallQualityScore = qualityPassed / qualityTestCases.length;
      const passed = overallQualityScore >= 0.75; // 75% of test cases should pass quality check

      return {
        testName,
        category: 'functionality',
        passed,
        score: overallQualityScore,
        executionTime: Date.now() - startTime,
        details: {
          overallQualityScore,
          qualityPassed,
          totalTestCases: qualityTestCases.length,
          qualityResults
        },
        riskLevel: passed ? 'low' : 'medium'
      };

    } catch (error) {
      return {
        testName,
        category: 'functionality',
        passed: false,
        score: 0,
        executionTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) },
        riskLevel: 'high'
      };
    }
  }

  private static async testCategoryRecognition(): Promise<RegressionTestResult> {
    const testName = "Category Recognition Accuracy";
    const startTime = Date.now();
    
    try {
      const categoryTests = [
        { query: "create wireframes and mockups", expectedCategory: "design" },
        { query: "debug Python code", expectedCategory: "development" },
        { query: "analyze customer data", expectedCategory: "analytics" },
        { query: "schedule team meetings", expectedCategory: "communication" }
      ];

      let correctCategories = 0;
      const categoryResults = [];

      for (const test of categoryTests) {
        try {
          const result = await smartRecommendationEngine.getSmartRecommendation(
            test.query,
            undefined,
            { sessionId: `category-${Date.now()}`, language: "en" }
          );

          const detectedTaskType = smartRecommendationEngine.detectTaskType(test.query);
          const categoryCorrect = detectedTaskType?.toLowerCase() === test.expectedCategory.toLowerCase();

          if (categoryCorrect) correctCategories++;

          categoryResults.push({
            query: test.query,
            expected: test.expectedCategory,
            detected: detectedTaskType,
            correct: categoryCorrect
          });

        } catch (error) {
          categoryResults.push({
            query: test.query,
            expected: test.expectedCategory,
            correct: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const categoryAccuracy = correctCategories / categoryTests.length;
      const passed = categoryAccuracy >= 0.75; // 75% category accuracy expected

      return {
        testName,
        category: 'functionality',
        passed,
        score: categoryAccuracy,
        executionTime: Date.now() - startTime,
        details: {
          categoryAccuracy,
          correctCategories,
          totalTests: categoryTests.length,
          categoryResults
        },
        riskLevel: passed ? 'low' : 'medium'
      };

    } catch (error) {
      return {
        testName,
        category: 'functionality',
        passed: false,
        score: 0,
        executionTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) },
        riskLevel: 'medium'
      };
    }
  }

  private static async testUserPreferencesHandling(): Promise<RegressionTestResult> {
    const testName = "User Preferences Handling";
    const startTime = Date.now();
    
    try {
      const preferenceTests = [
        { 
          query: "design tool", 
          preferences: { budget_range: "free" },
          shouldInfluenceRecommendation: true
        },
        {
          query: "analytics platform",
          preferences: { categories: ["analytics"], budget_range: "enterprise" },
          shouldInfluenceRecommendation: true
        }
      ];

      let preferencesRespected = 0;
      const preferenceResults = [];

      for (const test of preferenceTests) {
        try {
          // Get recommendation without preferences
          const baseResult = await smartRecommendationEngine.getSmartRecommendation(
            test.query,
            undefined,
            { sessionId: `pref-base-${Date.now()}`, language: "en" }
          );

          // Get recommendation with preferences
          const prefResult = await smartRecommendationEngine.getSmartRecommendation(
            test.query,
            test.preferences,
            { sessionId: `pref-test-${Date.now()}`, language: "en" }
          );

          // Check if preferences influenced the result
          const influenced = baseResult.toolId !== prefResult.toolId || 
                           Math.abs(baseResult.confidenceScore - prefResult.confidenceScore) > 0.1;

          if (influenced === test.shouldInfluenceRecommendation) {
            preferencesRespected++;
          }

          preferenceResults.push({
            query: test.query,
            preferences: test.preferences,
            influenced,
            expectedInfluence: test.shouldInfluenceRecommendation,
            baseToolId: baseResult.toolId,
            prefToolId: prefResult.toolId,
            confidenceDifference: Math.abs(baseResult.confidenceScore - prefResult.confidenceScore)
          });

        } catch (error) {
          preferenceResults.push({
            query: test.query,
            preferences: test.preferences,
            influenced: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const preferencesHandledCorrectly = preferencesRespected / preferenceTests.length;
      const passed = preferencesHandledCorrectly >= 0.8;

      return {
        testName,
        category: 'functionality',
        passed,
        score: preferencesHandledCorrectly,
        executionTime: Date.now() - startTime,
        details: {
          preferencesHandledCorrectly,
          preferencesRespected,
          totalTests: preferenceTests.length,
          preferenceResults
        },
        riskLevel: passed ? 'low' : 'medium'
      };

    } catch (error) {
      return {
        testName,
        category: 'functionality',
        passed: false,
        score: 0,
        executionTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) },
        riskLevel: 'medium'
      };
    }
  }

  private static async testWorkflowIntegration(): Promise<RegressionTestResult> {
    const testName = "Workflow Integration Stability";
    const startTime = Date.now();
    
    try {
      // Test workflow-related functionality
      const workflowTasks = [
        { id: "step-1", name: "Research competitors" },
        { id: "step-2", name: "Create wireframes" },
        { id: "step-3", name: "Build prototype" }
      ];

      const workflowResult = await smartRecommendationEngine.processTasksInParallel(
        workflowTasks,
        { categories: ["research", "design", "development"] },
        { sessionId: `workflow-${Date.now()}`, language: "en" },
        `test-workflow-${Date.now()}`
      );

      const allTasksProcessed = workflowResult.length === workflowTasks.length;
      const allHaveRecommendations = workflowResult.every(r => r.toolId);
      const reasonableProcessingTime = (Date.now() - startTime) < 10000; // 10s max
      const validWorkflowContext = workflowResult.every(r => r.taskId);

      const passed = allTasksProcessed && allHaveRecommendations && reasonableProcessingTime && validWorkflowContext;

      return {
        testName,
        category: 'functionality',
        passed,
        score: passed ? 1.0 : 0.6,
        executionTime: Date.now() - startTime,
        details: {
          allTasksProcessed,
          allHaveRecommendations,
          reasonableProcessingTime,
          validWorkflowContext,
          inputTasks: workflowTasks.length,
          outputResults: workflowResult.length,
          processingTime: Date.now() - startTime
        },
        riskLevel: passed ? 'low' : 'high'
      };

    } catch (error) {
      return {
        testName,
        category: 'functionality',
        passed: false,
        score: 0,
        executionTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) },
        riskLevel: 'high'
      };
    }
  }
}

/**
 * Performance Regression Tests
 */
export class PerformanceRegressionTests {
  
  // Store baseline metrics for comparison
  private static baselineMetrics = {
    singleQueryTime: 500, // ms
    batchProcessingTime: 2000, // ms for 5 tasks
    memoryUsageIncrease: 50 // MB
  };

  static async runPerformanceTests(): Promise<RegressionTestResult[]> {
    console.log("🚀 Running Performance Regression Tests");
    
    const tests = [
      this.testSingleQueryPerformance(),
      this.testBatchProcessingPerformance(),
      this.testConcurrentRequestHandling(),
      this.testMemoryUsageRegression()
    ];

    return await Promise.all(tests);
  }

  private static async testSingleQueryPerformance(): Promise<RegressionTestResult> {
    const testName = "Single Query Performance";
    const startTime = Date.now();
    
    try {
      const performanceTests = [];
      const testQueries = [
        "design tool",
        "analytics platform", 
        "code editor",
        "project management tool",
        "communication app"
      ];

      for (const query of testQueries) {
        const queryStartTime = Date.now();
        
        await smartRecommendationEngine.getSmartRecommendation(
          query,
          undefined,
          { sessionId: `perf-${Date.now()}`, language: "en" }
        );
        
        const queryTime = Date.now() - queryStartTime;
        performanceTests.push(queryTime);
      }

      const avgQueryTime = performanceTests.reduce((sum, time) => sum + time, 0) / performanceTests.length;
      const maxQueryTime = Math.max(...performanceTests);
      const minQueryTime = Math.min(...performanceTests);

      // Performance regression check
      const baselineDeviation = (avgQueryTime - this.baselineMetrics.singleQueryTime) / this.baselineMetrics.singleQueryTime;
      const performanceAcceptable = avgQueryTime <= this.baselineMetrics.singleQueryTime * 1.5; // 50% degradation threshold
      const consistentPerformance = maxQueryTime <= avgQueryTime * 2; // No outliers more than 2x avg

      const passed = performanceAcceptable && consistentPerformance;

      return {
        testName,
        category: 'performance',
        passed,
        score: Math.max(0, 1 - Math.abs(baselineDeviation)),
        executionTime: Date.now() - startTime,
        baselineComparison: {
          current: avgQueryTime,
          baseline: this.baselineMetrics.singleQueryTime,
          deviation: baselineDeviation
        },
        details: {
          avgQueryTime,
          maxQueryTime,
          minQueryTime,
          performanceAcceptable,
          consistentPerformance,
          queriesTested: testQueries.length,
          individualTimes: performanceTests
        },
        riskLevel: passed ? 'low' : baselineDeviation > 1.0 ? 'critical' : 'medium',
        recommendations: passed ? [] : [
          'Profile slow query operations',
          'Optimize database queries and caching',
          'Review RAG pipeline efficiency',
          'Consider implementing query result caching'
        ]
      };

    } catch (error) {
      return {
        testName,
        category: 'performance',
        passed: false,
        score: 0,
        executionTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) },
        riskLevel: 'critical'
      };
    }
  }

  private static async testBatchProcessingPerformance(): Promise<RegressionTestResult> {
    const testName = "Batch Processing Performance";
    const startTime = Date.now();
    
    try {
      const batchTasks = [
        { id: "batch-1", name: "Create dashboard" },
        { id: "batch-2", name: "Design wireframes" }, 
        { id: "batch-3", name: "Set up database" },
        { id: "batch-4", name: "Write documentation" },
        { id: "batch-5", name: "Deploy application" }
      ];

      const batchStartTime = Date.now();
      
      await smartRecommendationEngine.processTasksInParallel(
        batchTasks,
        { categories: ["analytics", "design", "development", "documentation", "devops"] },
        { sessionId: `batch-perf-${Date.now()}`, language: "en" },
        `perf-test-workflow-${Date.now()}`
      );
      
      const batchProcessingTime = Date.now() - batchStartTime;
      const timePerTask = batchProcessingTime / batchTasks.length;

      const baselineDeviation = (batchProcessingTime - this.baselineMetrics.batchProcessingTime) / this.baselineMetrics.batchProcessingTime;
      const performanceAcceptable = batchProcessingTime <= this.baselineMetrics.batchProcessingTime * 1.5;
      const efficientBatchProcessing = timePerTask <= this.baselineMetrics.singleQueryTime * 0.8; // Should be more efficient than individual queries

      const passed = performanceAcceptable && efficientBatchProcessing;

      return {
        testName,
        category: 'performance',
        passed,
        score: Math.max(0, 1 - Math.abs(baselineDeviation)),
        executionTime: Date.now() - startTime,
        baselineComparison: {
          current: batchProcessingTime,
          baseline: this.baselineMetrics.batchProcessingTime,
          deviation: baselineDeviation
        },
        details: {
          batchProcessingTime,
          timePerTask,
          performanceAcceptable,
          efficientBatchProcessing,
          tasksProcessed: batchTasks.length
        },
        riskLevel: passed ? 'low' : baselineDeviation > 1.0 ? 'critical' : 'medium'
      };

    } catch (error) {
      return {
        testName,
        category: 'performance',
        passed: false,
        score: 0,
        executionTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) },
        riskLevel: 'critical'
      };
    }
  }

  private static async testConcurrentRequestHandling(): Promise<RegressionTestResult> {
    const testName = "Concurrent Request Handling";
    const startTime = Date.now();
    
    try {
      const concurrentRequests = 10;
      const testQuery = "project management tool";
      
      // Create concurrent requests
      const concurrentPromises = Array(concurrentRequests).fill(0).map(async (_, index) => {
        const requestStart = Date.now();
        try {
          const result = await smartRecommendationEngine.getSmartRecommendation(
            `${testQuery} ${index}`,
            undefined,
            { sessionId: `concurrent-${index}-${Date.now()}`, language: "en" }
          );
          return {
            success: true,
            duration: Date.now() - requestStart,
            hasResult: !!result.toolId
          };
        } catch (error) {
          return {
            success: false,
            duration: Date.now() - requestStart,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });

      const results = await Promise.all(concurrentPromises);
      const totalConcurrentTime = Date.now() - startTime;
      
      const successfulRequests = results.filter(r => r.success).length;
      const successRate = successfulRequests / concurrentRequests;
      const avgRequestTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const maxRequestTime = Math.max(...results.map(r => r.duration));

      const acceptableSuccessRate = successRate >= 0.9; // 90% success rate
      const reasonableResponseTime = avgRequestTime <= this.baselineMetrics.singleQueryTime * 2; // 2x single query time is reasonable under load
      const noTimeouts = maxRequestTime <= 5000; // No request should take more than 5 seconds

      const passed = acceptableSuccessRate && reasonableResponseTime && noTimeouts;

      return {
        testName,
        category: 'performance',
        passed,
        score: (successRate + Math.max(0, 1 - avgRequestTime/2000)) / 2, // Balance success rate and performance
        executionTime: Date.now() - startTime,
        details: {
          concurrentRequests,
          successfulRequests,
          successRate,
          avgRequestTime,
          maxRequestTime,
          totalConcurrentTime,
          acceptableSuccessRate,
          reasonableResponseTime,
          noTimeouts
        },
        riskLevel: passed ? 'low' : successRate < 0.7 ? 'critical' : 'medium'
      };

    } catch (error) {
      return {
        testName,
        category: 'performance',
        passed: false,
        score: 0,
        executionTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) },
        riskLevel: 'critical'
      };
    }
  }

  private static async testMemoryUsageRegression(): Promise<RegressionTestResult> {
    const testName = "Memory Usage Regression";
    const startTime = Date.now();
    
    try {
      // Note: In a real implementation, you'd use process.memoryUsage() or similar
      // For this test, we'll simulate memory usage monitoring
      
      const initialMemory = process.memoryUsage();
      const initialHeapUsed = initialMemory.heapUsed / 1024 / 1024; // MB

      // Perform memory-intensive operations
      const memoryTestTasks = Array(20).fill(0).map((_, i) => ({ 
        id: `mem-task-${i}`, 
        name: `Memory test task ${i}` 
      }));

      await smartRecommendationEngine.processTasksInParallel(
        memoryTestTasks,
        undefined,
        { sessionId: `memory-test-${Date.now()}`, language: "en" },
        `memory-test-workflow-${Date.now()}`
      );

      const finalMemory = process.memoryUsage();
      const finalHeapUsed = finalMemory.heapUsed / 1024 / 1024; // MB
      const memoryIncrease = finalHeapUsed - initialHeapUsed;

      const acceptableMemoryUsage = memoryIncrease <= this.baselineMetrics.memoryUsageIncrease * 2; // 2x baseline is acceptable
      const noMemoryLeaks = memoryIncrease <= this.baselineMetrics.memoryUsageIncrease * 3; // 3x suggests potential leak

      const passed = acceptableMemoryUsage && noMemoryLeaks;

      return {
        testName,
        category: 'performance',
        passed,
        score: Math.max(0, 1 - (memoryIncrease / (this.baselineMetrics.memoryUsageIncrease * 2))),
        executionTime: Date.now() - startTime,
        baselineComparison: {
          current: memoryIncrease,
          baseline: this.baselineMetrics.memoryUsageIncrease,
          deviation: (memoryIncrease - this.baselineMetrics.memoryUsageIncrease) / this.baselineMetrics.memoryUsageIncrease
        },
        details: {
          initialMemory: initialHeapUsed,
          finalMemory: finalHeapUsed,
          memoryIncrease,
          acceptableMemoryUsage,
          noMemoryLeaks,
          tasksProcessed: memoryTestTasks.length
        },
        riskLevel: passed ? 'low' : memoryIncrease > this.baselineMetrics.memoryUsageIncrease * 5 ? 'critical' : 'medium',
        recommendations: passed ? [] : [
          'Profile memory usage during operations',
          'Check for memory leaks in RAG pipeline',
          'Implement proper resource cleanup',
          'Consider implementing memory usage limits'
        ]
      };

    } catch (error) {
      return {
        testName,
        category: 'performance',
        passed: false,
        score: 0,
        executionTime: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : String(error) },
        riskLevel: 'medium'
      };
    }
  }
}

/**
 * Master Regression Test Suite Runner
 */
export class RegressionTestRunner {
  
  static async runCompleteRegressionSuite(): Promise<{
    overallPassed: boolean;
    suites: RegressionTestSuite[];
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      overallScore: number;
      riskLevel: string;
      blockingIssues: string[];
    };
    recommendations: string[];
  }> {
    console.log("🔍 Starting Comprehensive Regression Test Suite");
    console.log("=".repeat(70));

    const suites: RegressionTestSuite[] = [];

    // API Compatibility Tests
    const apiTests = await ApiCompatibilityTests.runApiCompatibilityTests();
    suites.push({
      name: "API Compatibility",
      description: "Ensures API endpoints remain compatible with existing integrations",
      tests: apiTests,
      overallPassed: apiTests.every(t => t.passed),
      overallScore: apiTests.reduce((sum, t) => sum + t.score, 0) / apiTests.length,
      riskAssessment: this.assessSuiteRisk(apiTests),
      blockingIssues: apiTests.filter(t => !t.passed && (t.riskLevel === 'critical' || t.riskLevel === 'high')).map(t => t.testName),
      warnings: apiTests.filter(t => !t.passed && t.riskLevel === 'medium').map(t => t.testName)
    });

    // Functionality Tests
    const functionalityTests = await FunctionalityRegressionTests.runFunctionalityTests();
    suites.push({
      name: "Core Functionality",
      description: "Validates that core features continue to work as expected",
      tests: functionalityTests,
      overallPassed: functionalityTests.every(t => t.passed),
      overallScore: functionalityTests.reduce((sum, t) => sum + t.score, 0) / functionalityTests.length,
      riskAssessment: this.assessSuiteRisk(functionalityTests),
      blockingIssues: functionalityTests.filter(t => !t.passed && (t.riskLevel === 'critical' || t.riskLevel === 'high')).map(t => t.testName),
      warnings: functionalityTests.filter(t => !t.passed && t.riskLevel === 'medium').map(t => t.testName)
    });

    // Performance Tests
    const performanceTests = await PerformanceRegressionTests.runPerformanceTests();
    suites.push({
      name: "Performance Regression",
      description: "Detects performance degradation compared to baseline metrics",
      tests: performanceTests,
      overallPassed: performanceTests.every(t => t.passed),
      overallScore: performanceTests.reduce((sum, t) => sum + t.score, 0) / performanceTests.length,
      riskAssessment: this.assessSuiteRisk(performanceTests),
      blockingIssues: performanceTests.filter(t => !t.passed && (t.riskLevel === 'critical' || t.riskLevel === 'high')).map(t => t.testName),
      warnings: performanceTests.filter(t => !t.passed && t.riskLevel === 'medium').map(t => t.testName)
    });

    // Calculate overall results
    const totalTests = suites.reduce((sum, s) => sum + s.tests.length, 0);
    const passedTests = suites.reduce((sum, s) => sum + s.tests.filter(t => t.passed).length, 0);
    const failedTests = totalTests - passedTests;
    const overallScore = suites.reduce((sum, s) => sum + s.overallScore, 0) / suites.length;
    const overallPassed = suites.every(s => s.overallPassed);

    // Risk assessment
    const allBlockingIssues = suites.flatMap(s => s.blockingIssues);
    const riskLevel = this.assessOverallRisk(suites, overallScore, allBlockingIssues.length);

    // Generate recommendations
    const recommendations = this.generateRegressionRecommendations(suites, overallScore, allBlockingIssues);

    const summary = {
      totalTests,
      passedTests,
      failedTests,
      overallScore,
      riskLevel,
      blockingIssues: allBlockingIssues
    };

    this.displayRegressionSummary(summary, suites);

    return {
      overallPassed,
      suites,
      summary,
      recommendations
    };
  }

  private static assessSuiteRisk(tests: RegressionTestResult[]): string {
    const criticalIssues = tests.filter(t => t.riskLevel === 'critical').length;
    const highIssues = tests.filter(t => t.riskLevel === 'high').length;
    const mediumIssues = tests.filter(t => t.riskLevel === 'medium').length;
    
    if (criticalIssues > 0) return 'CRITICAL - Deployment blocked';
    if (highIssues > 1) return 'HIGH - Major issues require attention';
    if (highIssues === 1 || mediumIssues > 2) return 'MEDIUM - Monitor closely';
    return 'LOW - Acceptable for deployment';
  }

  private static assessOverallRisk(suites: RegressionTestSuite[], overallScore: number, blockingIssuesCount: number): string {
    if (blockingIssuesCount > 0) return 'CRITICAL';
    if (overallScore < 0.6) return 'HIGH';  
    if (overallScore < 0.8) return 'MEDIUM';
    return 'LOW';
  }

  private static generateRegressionRecommendations(suites: RegressionTestSuite[], overallScore: number, blockingIssues: string[]): string[] {
    const recommendations: string[] = [];

    if (blockingIssues.length > 0) {
      recommendations.push('🚨 CRITICAL: Address all blocking issues before deployment');
      recommendations.push(`Blocking issues: ${blockingIssues.join(', ')}`);
    }

    if (overallScore < 0.7) {
      recommendations.push('⚠️ Overall regression score is low - investigate major degradations');
    }

    const apiSuite = suites.find(s => s.name === 'API Compatibility');
    if (apiSuite && !apiSuite.overallPassed) {
      recommendations.push('🔧 Fix API compatibility issues to ensure smooth integration');
    }

    const perfSuite = suites.find(s => s.name === 'Performance Regression');
    if (perfSuite && perfSuite.overallScore < 0.7) {
      recommendations.push('🚀 Optimize performance to meet baseline requirements');
    }

    const funcSuite = suites.find(s => s.name === 'Core Functionality');
    if (funcSuite && !funcSuite.overallPassed) {
      recommendations.push('⚙️ Address core functionality regressions');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All regression tests passed - system ready for deployment');
    }

    return recommendations;
  }

  private static displayRegressionSummary(summary: any, suites: RegressionTestSuite[]): void {
    console.log("\n" + "=".repeat(70));
    console.log("🏁 Regression Test Suite Summary");
    console.log("=".repeat(70));

    console.log(`\n📊 OVERALL RESULTS:`);
    console.log(`Tests Passed: ${summary.passedTests}/${summary.totalTests}`);
    console.log(`Overall Score: ${(summary.overallScore * 100).toFixed(1)}%`);
    console.log(`Risk Level: ${summary.riskLevel}`);

    if (summary.blockingIssues.length > 0) {
      console.log(`\n🚨 BLOCKING ISSUES (${summary.blockingIssues.length}):`);
      summary.blockingIssues.forEach((issue: string) => console.log(`  - ${issue}`));
    }

    console.log(`\n📋 SUITE DETAILS:`);
    suites.forEach(suite => {
      const status = suite.overallPassed ? '✅' : '❌';
      console.log(`${status} ${suite.name}: ${(suite.overallScore * 100).toFixed(1)}% (${suite.tests.filter(t => t.passed).length}/${suite.tests.length})`);
      console.log(`   Risk: ${suite.riskAssessment}`);
    });
  }
}

export default RegressionTestRunner;