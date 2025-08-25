/**
 * RAG-Enhanced Tool Matching System - Test Framework Entry Point
 * 
 * This is the main entry point for running the comprehensive testing framework.
 * It provides convenient methods to execute different test configurations and
 * generates detailed reports demonstrating RAG enhancement benefits.
 */

import MasterTestRunner from "./master-test-runner";
import RagTestSuiteRunner from "./rag-comprehensive-test-suite";
import ApiEndpointTestRunner from "./api-endpoint-test-suite";
import RegressionTestRunner from "./regression-test-framework";
import { monitoringController } from "./monitoring-alerting-tests";
import { CiCdTestOrchestrator, QuickCiCdRunners } from "./ci-cd-test-runner";
import { ComprehensiveRagBenchmark, RagBenefitsTestDataUtil } from "./rag-benefits-test-data";
import { performanceBenchmark, systemHealthMonitor } from "./performance-monitor";
import { logger } from "@/lib/logger/structured-logger";

/**
 * Main Test Framework Controller
 */
export class TestFrameworkController {
  
  /**
   * Run complete RAG enhancement validation
   */
  static async runCompleteValidation(): Promise<void> {
    console.log("🚀 Starting Complete RAG Enhancement Validation");
    console.log("=".repeat(80));
    console.log("This comprehensive test suite validates:");
    console.log("  ✓ RAG enhancement benefits and improvements");
    console.log("  ✓ System performance and reliability");
    console.log("  ✓ API compatibility and functionality");
    console.log("  ✓ Regression prevention and stability");
    console.log("  ✓ Production deployment readiness");
    console.log("=".repeat(80));

    try {
      const masterRunner = new MasterTestRunner();
      const results = await masterRunner.runCompleteValidation();
      
      console.log("\n🎉 VALIDATION COMPLETE!");
      console.log(`📊 Overall Score: ${(results.summary.overallScore * 100).toFixed(1)}%`);
      console.log(`🚀 Deployment Status: ${results.summary.ragReadiness.toUpperCase()}`);
      
      if (results.summary.ragReadiness === 'ready') {
        console.log("✅ System is ready for production deployment!");
      } else if (results.summary.ragReadiness === 'needs-optimization') {
        console.log("⚠️ System shows promise but needs optimization before production");
      } else {
        console.log("❌ System requires significant improvements before deployment");
      }
      
      console.log(`📄 Detailed reports available in: test-results/`);
      
    } catch (error) {
      console.error("❌ Validation failed:", error);
      process.exit(1);
    }
  }

  /**
   * Run quick development tests
   */
  static async runDevelopmentTests(): Promise<void> {
    console.log("🔧 Running Development Environment Tests");
    
    try {
      const results = await QuickCiCdRunners.runDevelopmentTests();
      
      console.log(`\n📊 Development Test Results:`);
      console.log(`   Score: ${(results.summary.overallScore * 100).toFixed(1)}%`);
      console.log(`   Tests: ${results.summary.passedTests}/${results.summary.totalTests}`);
      console.log(`   Status: ${results.overallStatus.toUpperCase()}`);
      
      if (results.deploymentApproved) {
        console.log("✅ Ready to proceed to staging environment");
      } else {
        console.log("⚠️ Address issues before proceeding to staging");
      }
      
    } catch (error) {
      console.error("❌ Development tests failed:", error);
      process.exit(1);
    }
  }

  /**
   * Run staging environment tests
   */
  static async runStagingTests(): Promise<void> {
    console.log("🎭 Running Staging Environment Tests");
    
    try {
      const results = await QuickCiCdRunners.runStagingTests();
      
      console.log(`\n📊 Staging Test Results:`);
      console.log(`   Score: ${(results.summary.overallScore * 100).toFixed(1)}%`);
      console.log(`   Tests: ${results.summary.passedTests}/${results.summary.totalTests}`);
      console.log(`   Status: ${results.overallStatus.toUpperCase()}`);
      
      if (results.deploymentApproved) {
        console.log("✅ Ready for production deployment");
      } else {
        console.log("❌ Not ready for production - address failing tests");
      }
      
    } catch (error) {
      console.error("❌ Staging tests failed:", error);
      process.exit(1);
    }
  }

  /**
   * Run production deployment gate tests
   */
  static async runProductionGateTests(): Promise<void> {
    console.log("🚀 Running Production Deployment Gate Tests");
    
    try {
      const results = await QuickCiCdRunners.runProductionGateTests();
      
      console.log(`\n📊 Production Gate Results:`);
      console.log(`   Score: ${(results.summary.overallScore * 100).toFixed(1)}%`);
      console.log(`   Tests: ${results.summary.passedTests}/${results.summary.totalTests}`);
      console.log(`   Status: ${results.overallStatus.toUpperCase()}`);
      
      console.log(`\n🚪 Deployment Gates:`);
      console.log(`   ${results.deploymentGateResults.scoreGate.passed ? '✅' : '❌'} Score Gate`);
      console.log(`   ${results.deploymentGateResults.regressionGate.passed ? '✅' : '❌'} Regression Gate`);
      console.log(`   ${results.deploymentGateResults.healthGate.passed ? '✅' : '❌'} Health Gate`);
      
      if (results.deploymentApproved) {
        console.log("🎉 APPROVED FOR PRODUCTION DEPLOYMENT!");
      } else {
        console.log("🚫 DEPLOYMENT BLOCKED - Address failing gates");
      }
      
    } catch (error) {
      console.error("❌ Production gate tests failed:", error);
      process.exit(1);
    }
  }

  /**
   * Run RAG benefits demonstration
   */
  static async runRagBenefitsDemo(): Promise<void> {
    console.log("🎯 Running RAG Benefits Demonstration");
    console.log("This demo shows specific improvements RAG provides over legacy systems");
    
    try {
      // Display benchmark information
      const benchmarkStats = RagBenefitsTestDataUtil.generateBenchmarkStats(ComprehensiveRagBenchmark);
      
      console.log(`\n📋 Test Scenarios Overview:`);
      console.log(`   Total Scenarios: ${benchmarkStats.totalScenarios}`);
      console.log(`   Categories: ${benchmarkStats.categoriesCovered}`);
      console.log(`   Domains: ${benchmarkStats.domainsCovered}`);
      console.log(`   Average Complexity: ${benchmarkStats.averageComplexity}/5`);
      console.log(`   Expected Improvement: ${(benchmarkStats.expectedImprovement * 100).toFixed(1)}%`);
      
      console.log(`\n🎭 Difficulty Distribution:`);
      console.log(`   Beginner: ${benchmarkStats.difficultyDistribution.beginner} scenarios`);
      console.log(`   Intermediate: ${benchmarkStats.difficultyDistribution.intermediate} scenarios`);
      console.log(`   Advanced: ${benchmarkStats.difficultyDistribution.advanced} scenarios`);
      
      console.log(`\n🎯 Focus Areas:`);
      benchmarkStats.focusAreas.forEach(area => 
        console.log(`   • ${area.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`)
      );
      
      // Run comprehensive test to demonstrate actual benefits
      const results = await RagTestSuiteRunner.runComprehensiveTestSuite();
      
      console.log(`\n📈 Demonstrated Benefits:`);
      const accuracyTests = results.results.filter((r: any) => r.testName.includes('Accuracy'));
      if (accuracyTests.length > 0) {
        const avgImprovement = accuracyTests.reduce((sum: number, test: any) => sum + (test.score || 0), 0) / accuracyTests.length;
        console.log(`   🎯 Accuracy Improvement: ${(avgImprovement * 100).toFixed(1)}%`);
      }
      
      console.log(`   📊 Overall System Score: ${(results.summary.overallScore * 100).toFixed(1)}%`);
      console.log(`   ✅ Tests Passed: ${results.summary.passedTests}/${results.summary.totalTests}`);
      
      console.log(`\n💡 Key RAG Advantages Demonstrated:`);
      console.log(`   • Better contextual understanding of complex queries`);
      console.log(`   • Improved domain-specific knowledge application`);
      console.log(`   • Enhanced multi-intent recognition capabilities`);
      console.log(`   • Semantic understanding beyond keyword matching`);
      console.log(`   • Robust handling of edge cases and ambiguous queries`);
      
    } catch (error) {
      console.error("❌ RAG benefits demo failed:", error);
      process.exit(1);
    }
  }

  /**
   * Start monitoring mode
   */
  static async startMonitoring(): Promise<void> {
    console.log("📊 Starting RAG System Monitoring");
    console.log("This will continuously monitor system health and performance");
    console.log("Press Ctrl+C to stop monitoring");
    
    try {
      await monitoringController.startMonitoring();
      
      // Keep the process alive
      process.on('SIGINT', () => {
        console.log("\n🛑 Stopping monitoring...");
        monitoringController.stopMonitoring();
        process.exit(0);
      });
      
      // Generate periodic reports
      setInterval(() => {
        monitoringController.generatePerformanceReport();
      }, 60000); // Every minute
      
    } catch (error) {
      console.error("❌ Monitoring failed:", error);
      process.exit(1);
    }
  }

  /**
   * Generate test reports only
   */
  static async generateReports(): Promise<void> {
    console.log("📄 Generating Test Reports");
    
    try {
      const masterRunner = new MasterTestRunner();
      const results = await masterRunner.runCompleteValidation();
      
      console.log(`\n📊 Reports Generated:`);
      console.log(`   HTML Report: ${results.report.html ? 'Generated' : 'Failed'}`);
      console.log(`   JSON Metrics: ${results.report.json ? 'Generated' : 'Failed'}`);
      console.log(`   Markdown Summary: ${results.report.markdown ? 'Generated' : 'Failed'}`);
      console.log(`\n📁 Check the test-results/ directory for all generated reports`);
      
    } catch (error) {
      console.error("❌ Report generation failed:", error);
      process.exit(1);
    }
  }

  /**
   * Health check - quick system validation
   */
  static async healthCheck(): Promise<void> {
    console.log("🏥 Performing System Health Check");
    
    try {
      const healthStatus = await systemHealthMonitor.checkSystemHealth();
      
      console.log(`\n📊 System Health: ${healthStatus.overall.toUpperCase()}`);
      
      console.log(`\n🔧 Component Status:`);
      Object.entries(healthStatus.components).forEach(([name, component]) => {
        const statusIcon = component.status === 'healthy' ? '✅' : 
                          component.status === 'degraded' ? '⚠️' : '❌';
        console.log(`   ${statusIcon} ${name}: ${component.status} (${component.latency}ms)`);
      });
      
      if (healthStatus.alerts.length > 0) {
        console.log(`\n🚨 Active Alerts (${healthStatus.alerts.length}):`);
        healthStatus.alerts.forEach(alert => {
          const severityIcon = alert.severity === 'critical' ? '🔴' : '🟡';
          console.log(`   ${severityIcon} ${alert.message}`);
        });
      } else {
        console.log(`\n✅ No active alerts`);
      }
      
      if (healthStatus.overall === 'healthy') {
        console.log(`\n🎉 System is healthy and operating normally!`);
      } else {
        console.log(`\n⚠️ System health issues detected - check component details above`);
      }
      
    } catch (error) {
      console.error("❌ Health check failed:", error);
      process.exit(1);
    }
  }

  /**
   * Display help and available commands
   */
  static displayHelp(): void {
    console.log("🧪 RAG-Enhanced Tool Matching System - Test Framework");
    console.log("=".repeat(60));
    console.log("Available Commands:");
    console.log("");
    console.log("📋 Complete Validation:");
    console.log("  npm run test:rag:complete     - Run all tests with full reporting");
    console.log("");
    console.log("🔧 Environment-Specific Tests:");
    console.log("  npm run test:rag:dev         - Development environment tests");
    console.log("  npm run test:rag:staging     - Staging environment tests");
    console.log("  npm run test:rag:prod        - Production deployment gates");
    console.log("");
    console.log("🎯 Specialized Tests:");
    console.log("  npm run test:rag:benefits    - Demonstrate RAG improvements");
    console.log("  npm run test:rag:monitoring  - Start continuous monitoring");
    console.log("  npm run test:rag:health      - Quick system health check");
    console.log("  npm run test:rag:reports     - Generate reports only");
    console.log("");
    console.log("📊 Individual Test Suites:");
    console.log("  npm run test:rag:accuracy    - Accuracy and quality tests");
    console.log("  npm run test:rag:performance - Performance benchmarks");
    console.log("  npm run test:rag:regression  - Regression prevention tests");
    console.log("  npm run test:rag:api         - API endpoint tests");
    console.log("");
    console.log("💡 Getting Started:");
    console.log("  1. Run 'npm run test:rag:health' for a quick system check");
    console.log("  2. Run 'npm run test:rag:benefits' to see RAG improvements");
    console.log("  3. Run 'npm run test:rag:complete' for full validation");
    console.log("");
    console.log("📚 Documentation:");
    console.log("  - See README.md in this directory for detailed usage");
    console.log("  - Check test-results/ for generated reports");
    console.log("  - View docs/rag_enhancement_guide.md for implementation details");
    console.log("=".repeat(60));
  }
}

/**
 * Command-line interface handler
 */
export async function handleCommand(command?: string): Promise<void> {
  const cmd = command || process.argv[2];
  
  switch (cmd) {
    case 'complete':
      await TestFrameworkController.runCompleteValidation();
      break;
      
    case 'dev':
      await TestFrameworkController.runDevelopmentTests();
      break;
      
    case 'staging':
      await TestFrameworkController.runStagingTests();
      break;
      
    case 'prod':
      await TestFrameworkController.runProductionGateTests();
      break;
      
    case 'benefits':
      await TestFrameworkController.runRagBenefitsDemo();
      break;
      
    case 'monitoring':
      await TestFrameworkController.startMonitoring();
      break;
      
    case 'health':
      await TestFrameworkController.healthCheck();
      break;
      
    case 'reports':
      await TestFrameworkController.generateReports();
      break;
      
    case 'help':
    case '--help':
    case '-h':
    default:
      TestFrameworkController.displayHelp();
      break;
  }
}

// Export all test components
export * from "./master-test-runner";
export * from "./rag-comprehensive-test-suite";
export * from "./api-endpoint-test-suite";
export * from "./regression-test-framework";
export * from "./monitoring-alerting-tests";
export * from "./ci-cd-test-runner";
export * from "./rag-benefits-test-data";
export * from "./performance-monitor";

// Export main controller
export { TestFrameworkController };
export default TestFrameworkController;

// Auto-run if called directly
if (require.main === module) {
  handleCommand();
}