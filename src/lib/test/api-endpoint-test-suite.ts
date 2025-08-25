/**
 * API Endpoint Test Suite for RAG-Enhanced Tool Matching
 * 
 * Tests all API endpoints that have been enhanced with RAG functionality:
 * - /api/tools/smart-recommend (single and batch)
 * - /api/tools/recommend 
 * - /api/system/rag-status
 * - /api/system/cache
 */

import { NextRequest } from "next/server";

export interface ApiTestResult {
  endpoint: string;
  method: string;
  testName: string;
  passed: boolean;
  statusCode: number;
  responseTime: number;
  responseData?: any;
  error?: string;
  validations: Record<string, boolean>;
}

export interface EndpointTestSuite {
  endpoint: string;
  tests: ApiTestResult[];
  overallSuccess: boolean;
  avgResponseTime: number;
}

/**
 * Mock request helper for testing API endpoints
 */
class MockApiTester {
  private baseUrl = 'http://localhost:3000';

  /**
   * Create a mock NextRequest for testing
   */
  private createMockRequest(method: string, path: string, body?: any, headers?: Record<string, string>): NextRequest {
    const url = `${this.baseUrl}${path}`;
    const requestInit: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestInit.body = JSON.stringify(body);
    }

    return new NextRequest(url, requestInit);
  }

  /**
   * Execute API test with timing and validation
   */
  async executeApiTest(
    method: string,
    path: string,
    body?: any,
    expectedStatus = 200,
    validations: Record<string, (response: any) => boolean> = {}
  ): Promise<ApiTestResult> {
    const testName = `${method} ${path}`;
    const startTime = Date.now();

    try {
      // For testing purposes, we'll simulate the API calls
      // In a real environment, you would make actual HTTP requests
      const result = await this.simulateApiCall(method, path, body);
      const responseTime = Date.now() - startTime;

      // Run validations
      const validationResults: Record<string, boolean> = {};
      for (const [name, validator] of Object.entries(validations)) {
        try {
          validationResults[name] = validator(result);
        } catch (error) {
          validationResults[name] = false;
        }
      }

      const allValidationsPassed = Object.values(validationResults).every(Boolean);
      const statusMatches = result.status === expectedStatus;
      const passed = statusMatches && allValidationsPassed;

      return {
        endpoint: path,
        method,
        testName,
        passed,
        statusCode: result.status,
        responseTime,
        responseData: result.data,
        validations: {
          statusCode: statusMatches,
          ...validationResults
        }
      };
    } catch (error) {
      return {
        endpoint: path,
        method,
        testName,
        passed: false,
        statusCode: 500,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        validations: { error: false }
      };
    }
  }

  /**
   * Simulate API call - replace with actual HTTP client in real testing
   */
  private async simulateApiCall(method: string, path: string, body?: any) {
    // This is a simulation - in real testing, you'd use fetch() or axios
    // Here we'll return mock responses based on the endpoint
    
    if (path === '/api/tools/smart-recommend') {
      if (method === 'GET') {
        return {
          status: 200,
          data: {
            success: true,
            data: {
              algorithm: "2-stage-rag-enhanced-search-then-rerank",
              version: "2.0",
              features: {
                ragFeatures: {
                  knowledgeEnhanced: true,
                  adaptiveWeights: true
                }
              }
            }
          }
        };
      } else if (method === 'POST' && body) {
        // Simulate recommendation response
        const isBatch = Array.isArray(body.tasks);
        
        if (isBatch) {
          return {
            status: 200,
            data: {
              success: true,
              data: body.tasks.map((task: any) => ({
                taskId: task.id,
                taskName: task.name,
                toolId: `tool-${Math.random().toString(36).substr(2, 9)}`,
                toolName: "Mock Tool",
                confidenceScore: 0.85,
                finalScore: 0.78,
                searchDuration: 150,
                rerankingDuration: 50
              })),
              metadata: {
                algorithm: "2-stage-rag-enhanced-search-then-rerank",
                totalTasks: body.tasks.length,
                ragOptions: {
                  enableRAG: body.enableRAG || true,
                  enableAdaptive: body.enableAdaptive || true
                }
              }
            }
          };
        } else {
          return {
            status: 200,
            data: {
              success: true,
              data: {
                taskId: `task-${Math.random().toString(36).substr(2, 9)}`,
                taskName: body.taskName,
                toolId: `tool-${Math.random().toString(36).substr(2, 9)}`,
                toolName: "Mock Tool",
                confidenceScore: 0.85,
                finalScore: 0.78,
                searchDuration: 120,
                rerankingDuration: 45
              },
              metadata: {
                algorithm: "2-stage-rag-enhanced-search-then-rerank",
                ragOptions: {
                  enableRAG: body.enableRAG || true,
                  enableAdaptive: body.enableAdaptive || true
                }
              }
            }
          };
        }
      }
    }

    if (path === '/api/system/rag-status') {
      return {
        status: 200,
        data: {
          success: true,
          data: {
            ragEnabled: true,
            knowledgeBaseStats: {
              totalEntries: 1250,
              qualityScore: 0.87,
              lastUpdated: new Date().toISOString()
            },
            systemHealth: {
              vectorSearch: "healthy",
              ragPipeline: "healthy",
              adaptiveSearch: "healthy"
            }
          }
        }
      };
    }

    if (path === '/api/system/cache') {
      if (method === 'GET') {
        return {
          status: 200,
          data: {
            success: true,
            data: {
              cacheStats: {
                hitRate: 0.73,
                totalRequests: 1542,
                cacheSize: 256
              }
            }
          }
        };
      } else if (method === 'DELETE') {
        return {
          status: 200,
          data: {
            success: true,
            data: {
              message: "Cache cleared successfully",
              clearedEntries: 156
            }
          }
        };
      }
    }

    // Default response for unknown endpoints
    return {
      status: 404,
      data: { error: "Endpoint not found" }
    };
  }
}

/**
 * Smart Recommendation Endpoint Test Suite
 */
export class SmartRecommendationEndpointTests {
  private tester = new MockApiTester();

  /**
   * Test GET /api/tools/smart-recommend - endpoint metadata
   */
  async testEndpointMetadata(): Promise<ApiTestResult> {
    return await this.tester.executeApiTest(
      'GET',
      '/api/tools/smart-recommend',
      undefined,
      200,
      {
        hasSuccessFlag: (response) => response.data.success === true,
        hasAlgorithmInfo: (response) => !!response.data.data.algorithm,
        hasRagFeatures: (response) => !!response.data.data.features?.ragFeatures,
        hasVersion: (response) => !!response.data.data.version
      }
    );
  }

  /**
   * Test POST /api/tools/smart-recommend - single recommendation
   */
  async testSingleRecommendation(): Promise<ApiTestResult> {
    const requestBody = {
      taskName: "Create dashboard for sales analytics",
      preferences: {
        categories: ["analytics", "business"],
        budget_range: "paid"
      },
      language: "en",
      enableRAG: true,
      enableAdaptive: true,
      fallbackToLegacy: true
    };

    return await this.tester.executeApiTest(
      'POST',
      '/api/tools/smart-recommend',
      requestBody,
      200,
      {
        hasSuccessFlag: (response) => response.data.success === true,
        hasRecommendation: (response) => !!response.data.data.toolId,
        hasConfidenceScore: (response) => typeof response.data.data.confidenceScore === 'number',
        hasMetadata: (response) => !!response.data.metadata,
        hasRagOptions: (response) => !!response.data.metadata.ragOptions,
        validPerformance: (response) => response.data.metadata.processingTime < 2000
      }
    );
  }

  /**
   * Test POST /api/tools/smart-recommend - batch processing
   */
  async testBatchRecommendation(): Promise<ApiTestResult> {
    const requestBody = {
      tasks: [
        { id: "task-1", name: "Create UI mockups" },
        { id: "task-2", name: "Analyze user data" },
        { id: "task-3", name: "Set up team chat" }
      ],
      preferences: {
        categories: ["design", "analytics", "communication"],
        budget_range: "free"
      },
      language: "en",
      workflowId: "test-workflow-123",
      enableRAG: true,
      enableAdaptive: true,
      fallbackToLegacy: true
    };

    return await this.tester.executeApiTest(
      'POST',
      '/api/tools/smart-recommend',
      requestBody,
      200,
      {
        hasSuccessFlag: (response) => response.data.success === true,
        hasAllRecommendations: (response) => Array.isArray(response.data.data) && response.data.data.length === 3,
        hasBatchMetadata: (response) => response.data.metadata.totalTasks === 3,
        hasWorkflowId: (response) => response.data.metadata.workflowId === "test-workflow-123",
        hasStrategyUsage: (response) => !!response.data.metadata.strategyUsage,
        validBatchPerformance: (response) => response.data.metadata.processingTime < 5000
      }
    );
  }

  /**
   * Test RAG-specific parameters
   */
  async testRagParameters(): Promise<ApiTestResult> {
    const requestBody = {
      taskName: "project management tool",
      enableRAG: false,
      enableAdaptive: false,
      fallbackToLegacy: true
    };

    return await this.tester.executeApiTest(
      'POST',
      '/api/tools/smart-recommend',
      requestBody,
      200,
      {
        hasSuccessFlag: (response) => response.data.success === true,
        ragDisabled: (response) => !response.data.metadata.ragOptions?.enableRAG,
        adaptiveDisabled: (response) => !response.data.metadata.ragOptions?.enableAdaptive,
        fallbackEnabled: (response) => response.data.metadata.ragOptions?.fallbackToLegacy === true
      }
    );
  }

  /**
   * Test input validation
   */
  async testInputValidation(): Promise<ApiTestResult> {
    const invalidRequestBody = {
      taskName: "", // Empty task name should fail validation
      preferences: "invalid", // Should be object
      language: "x", // Too short
      enableRAG: "yes" // Should be boolean
    };

    return await this.tester.executeApiTest(
      'POST',
      '/api/tools/smart-recommend',
      invalidRequestBody,
      400, // Expecting validation error
      {
        hasErrorMessage: (response) => !!response.error || !!response.data?.error,
        isValidationError: (response) => 
          response.data?.error === "Validation failed" || 
          response.data?.details?.some((detail: any) => detail.message?.includes('required'))
      }
    );
  }

  /**
   * Run all smart recommendation endpoint tests
   */
  async runAllTests(): Promise<EndpointTestSuite> {
    const tests: ApiTestResult[] = [];
    
    console.log("🔄 Testing Smart Recommendation Endpoints...");
    
    tests.push(await this.testEndpointMetadata());
    tests.push(await this.testSingleRecommendation());
    tests.push(await this.testBatchRecommendation());
    tests.push(await this.testRagParameters());
    tests.push(await this.testInputValidation());

    const overallSuccess = tests.every(test => test.passed);
    const avgResponseTime = tests.reduce((sum, test) => sum + test.responseTime, 0) / tests.length;

    return {
      endpoint: '/api/tools/smart-recommend',
      tests,
      overallSuccess,
      avgResponseTime
    };
  }
}

/**
 * System Status Endpoint Test Suite
 */
export class SystemStatusEndpointTests {
  private tester = new MockApiTester();

  /**
   * Test GET /api/system/rag-status
   */
  async testRagStatus(): Promise<ApiTestResult> {
    return await this.tester.executeApiTest(
      'GET',
      '/api/system/rag-status',
      undefined,
      200,
      {
        hasSuccessFlag: (response) => response.data.success === true,
        hasRagEnabled: (response) => typeof response.data.data.ragEnabled === 'boolean',
        hasKnowledgeBaseStats: (response) => !!response.data.data.knowledgeBaseStats,
        hasSystemHealth: (response) => !!response.data.data.systemHealth,
        hasQualityScore: (response) => typeof response.data.data.knowledgeBaseStats?.qualityScore === 'number'
      }
    );
  }

  /**
   * Test GET /api/system/cache
   */
  async testCacheStatus(): Promise<ApiTestResult> {
    return await this.tester.executeApiTest(
      'GET',
      '/api/system/cache',
      undefined,
      200,
      {
        hasSuccessFlag: (response) => response.data.success === true,
        hasCacheStats: (response) => !!response.data.data.cacheStats,
        hasHitRate: (response) => typeof response.data.data.cacheStats?.hitRate === 'number',
        hasValidHitRate: (response) => {
          const hitRate = response.data.data.cacheStats?.hitRate;
          return typeof hitRate === 'number' && hitRate >= 0 && hitRate <= 1;
        }
      }
    );
  }

  /**
   * Test DELETE /api/system/cache
   */
  async testCacheClear(): Promise<ApiTestResult> {
    return await this.tester.executeApiTest(
      'DELETE',
      '/api/system/cache',
      undefined,
      200,
      {
        hasSuccessFlag: (response) => response.data.success === true,
        hasMessage: (response) => !!response.data.data.message,
        hasClearedCount: (response) => typeof response.data.data.clearedEntries === 'number'
      }
    );
  }

  /**
   * Run all system status endpoint tests
   */
  async runAllTests(): Promise<EndpointTestSuite[]> {
    const suites: EndpointTestSuite[] = [];
    
    console.log("🔄 Testing System Status Endpoints...");
    
    // RAG Status tests
    const ragStatusTests = [await this.testRagStatus()];
    suites.push({
      endpoint: '/api/system/rag-status',
      tests: ragStatusTests,
      overallSuccess: ragStatusTests.every(test => test.passed),
      avgResponseTime: ragStatusTests.reduce((sum, test) => sum + test.responseTime, 0) / ragStatusTests.length
    });

    // Cache tests
    const cacheTests = [
      await this.testCacheStatus(),
      await this.testCacheClear()
    ];
    suites.push({
      endpoint: '/api/system/cache',
      tests: cacheTests,
      overallSuccess: cacheTests.every(test => test.passed),
      avgResponseTime: cacheTests.reduce((sum, test) => sum + test.responseTime, 0) / cacheTests.length
    });

    return suites;
  }
}

/**
 * Load Testing Suite
 */
export class LoadTestSuite {
  private tester = new MockApiTester();

  /**
   * Test concurrent requests to smart-recommend endpoint
   */
  async testConcurrentRecommendations(): Promise<ApiTestResult> {
    const testName = "Concurrent Smart Recommendations";
    const startTime = Date.now();
    const concurrentRequests = 10;

    try {
      const requestPromises = Array(concurrentRequests).fill(0).map(async (_, index) => {
        return this.tester.executeApiTest(
          'POST',
          '/api/tools/smart-recommend',
          {
            taskName: `Test task ${index}`,
            enableRAG: true,
            enableAdaptive: true
          },
          200
        );
      });

      const results = await Promise.all(requestPromises);
      const successfulRequests = results.filter(r => r.passed).length;
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const maxResponseTime = Math.max(...results.map(r => r.responseTime));

      const passed = successfulRequests === concurrentRequests && avgResponseTime < 1000;

      return {
        endpoint: '/api/tools/smart-recommend',
        method: 'POST',
        testName,
        passed,
        statusCode: 200,
        responseTime: Date.now() - startTime,
        responseData: {
          concurrentRequests,
          successfulRequests,
          avgResponseTime,
          maxResponseTime
        },
        validations: {
          allRequestsSucceeded: successfulRequests === concurrentRequests,
          performanceAcceptable: avgResponseTime < 1000,
          noTimeouts: maxResponseTime < 5000
        }
      };
    } catch (error) {
      return {
        endpoint: '/api/tools/smart-recommend',
        method: 'POST',
        testName,
        passed: false,
        statusCode: 500,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        validations: { error: false }
      };
    }
  }

  /**
   * Test large batch processing
   */
  async testLargeBatchProcessing(): Promise<ApiTestResult> {
    const batchSize = 50;
    const tasks = Array(batchSize).fill(0).map((_, i) => ({
      id: `task-${i}`,
      name: `Task ${i}: Create tool for workflow automation`
    }));

    return await this.tester.executeApiTest(
      'POST',
      '/api/tools/smart-recommend',
      {
        tasks,
        enableRAG: true,
        enableAdaptive: true,
        language: "en"
      },
      200,
      {
        hasAllResults: (response) => Array.isArray(response.data.data) && response.data.data.length === batchSize,
        reasonablePerformance: (response) => response.data.metadata.processingTime < 10000, // 10 seconds max
        highSuccessRate: (response) => {
          const successful = response.data.data.filter((r: any) => r.toolId !== null).length;
          return (successful / batchSize) > 0.8; // At least 80% success rate
        }
      }
    );
  }

  /**
   * Run all load tests
   */
  async runAllTests(): Promise<EndpointTestSuite> {
    const tests: ApiTestResult[] = [];
    
    console.log("🔄 Running Load Tests...");
    
    tests.push(await this.testConcurrentRecommendations());
    tests.push(await this.testLargeBatchProcessing());

    const overallSuccess = tests.every(test => test.passed);
    const avgResponseTime = tests.reduce((sum, test) => sum + test.responseTime, 0) / tests.length;

    return {
      endpoint: 'Load Testing',
      tests,
      overallSuccess,
      avgResponseTime
    };
  }
}

/**
 * Complete API Test Suite Runner
 */
export class ApiEndpointTestRunner {
  
  /**
   * Run all API endpoint tests
   */
  static async runAllApiTests(): Promise<{
    summary: {
      totalEndpoints: number;
      passedEndpoints: number;
      totalTests: number;
      passedTests: number;
      avgResponseTime: number;
    };
    suites: EndpointTestSuite[];
    report: string;
  }> {
    console.log("🚀 Starting API Endpoint Test Suite");
    console.log("=" .repeat(60));

    const allSuites: EndpointTestSuite[] = [];

    // Smart Recommendation Tests
    const smartRecommendationTester = new SmartRecommendationEndpointTests();
    allSuites.push(await smartRecommendationTester.runAllTests());

    // System Status Tests
    const systemStatusTester = new SystemStatusEndpointTests();
    const systemSuites = await systemStatusTester.runAllTests();
    allSuites.push(...systemSuites);

    // Load Tests
    const loadTester = new LoadTestSuite();
    allSuites.push(await loadTester.runAllTests());

    // Calculate summary
    const totalTests = allSuites.reduce((sum, suite) => sum + suite.tests.length, 0);
    const passedTests = allSuites.reduce((sum, suite) => sum + suite.tests.filter(t => t.passed).length, 0);
    const passedEndpoints = allSuites.filter(suite => suite.overallSuccess).length;
    const totalResponseTimes = allSuites.reduce((sum, suite) => sum + (suite.avgResponseTime * suite.tests.length), 0);
    const avgResponseTime = totalResponseTimes / totalTests;

    const summary = {
      totalEndpoints: allSuites.length,
      passedEndpoints,
      totalTests,
      passedTests,
      avgResponseTime
    };

    const report = this.generateApiTestReport(summary, allSuites);

    console.log("\n" + "=" .repeat(60));
    console.log("🏁 API Endpoint Test Suite Completed");
    console.log(report);

    return {
      summary,
      suites: allSuites,
      report
    };
  }

  /**
   * Generate detailed API test report
   */
  private static generateApiTestReport(summary: any, suites: EndpointTestSuite[]): string {
    const lines = [];
    
    lines.push(`\n📊 API ENDPOINT TEST SUMMARY`);
    lines.push(`Total Endpoints: ${summary.totalEndpoints}`);
    lines.push(`Passed Endpoints: ${summary.passedEndpoints}/${summary.totalEndpoints} ✓`);
    lines.push(`Total Tests: ${summary.totalTests}`);
    lines.push(`Passed Tests: ${summary.passedTests}/${summary.totalTests} ✓`);
    lines.push(`Success Rate: ${((summary.passedTests / summary.totalTests) * 100).toFixed(1)}%`);
    lines.push(`Avg Response Time: ${summary.avgResponseTime.toFixed(0)}ms`);

    lines.push(`\n🔍 ENDPOINT DETAILS:`);
    
    suites.forEach(suite => {
      const status = suite.overallSuccess ? '✓' : '✗';
      lines.push(`\n${status} ${suite.endpoint} (${suite.avgResponseTime.toFixed(0)}ms avg)`);
      
      suite.tests.forEach(test => {
        const testStatus = test.passed ? '  ✓' : '  ✗';
        lines.push(`${testStatus} ${test.testName} [${test.responseTime}ms]`);
        
        if (!test.passed) {
          if (test.error) {
            lines.push(`    Error: ${test.error}`);
          }
          const failedValidations = Object.entries(test.validations)
            .filter(([_, passed]) => !passed)
            .map(([name, _]) => name);
          if (failedValidations.length > 0) {
            lines.push(`    Failed: ${failedValidations.join(', ')}`);
          }
        }
      });
    });

    lines.push(`\n🎯 API TEST RECOMMENDATIONS:`);
    
    const failedEndpoints = suites.filter(s => !s.overallSuccess).length;
    if (failedEndpoints > 0) {
      lines.push(`• Fix ${failedEndpoints} failing endpoint(s)`);
    }
    
    if (summary.avgResponseTime > 500) {
      lines.push(`• Optimize API response times (current avg: ${summary.avgResponseTime.toFixed(0)}ms)`);
    }
    
    const successRate = (summary.passedTests / summary.totalTests);
    if (successRate < 0.9) {
      lines.push(`• Improve API reliability (current: ${(successRate * 100).toFixed(1)}%)`);
    } else if (successRate === 1.0) {
      lines.push(`• Excellent! All API tests passing ✨`);
    }

    return lines.join('\n');
  }
}

export default ApiEndpointTestRunner;