#!/usr/bin/env tsx

/**
 * Test script for Advanced Hybrid Search functionality
 */

import { advancedHybridSearch } from "../src/lib/supabase/vector-store";
import { smartRecommendationEngine } from "../src/lib/services/smart-recommendation-service";

async function testAdvancedHybridSearch() {
  console.log("🔍 Testing Advanced Hybrid Search...\n");
  
  const testQueries = [
    "AI development tool",
    "design collaboration platform", 
    "code review automation",
    "data visualization dashboard",
    "project management software"
  ];
  
  for (const query of testQueries) {
    console.log(`\n📝 Testing query: "${query}"`);
    console.log("=" .repeat(50));
    
    try {
      const results = await advancedHybridSearch(query, 3, 0.6, 0.4);
      
      if (results.length === 0) {
        console.log("❌ No results found");
        continue;
      }
      
      console.log(`✅ Found ${results.length} results:`);
      
      results.forEach((result, index) => {
        const metadata = result.metadata;
        console.log(`\n${index + 1}. ${metadata.name}`);
        console.log(`   Traditional Score: ${(metadata.traditional_score || 0).toFixed(4)}`);
        console.log(`   RAG Score: ${(metadata.rag_score || 0).toFixed(4)}`);
        console.log(`   Final Score: ${(metadata.final_score || 0).toFixed(4)}`);
        console.log(`   Strategy: ${metadata.search_strategy}`);
        console.log(`   Confidence: ${(metadata.confidence_score || 0).toFixed(4)}`);
      });
      
    } catch (error) {
      console.error(`❌ Error testing "${query}":`, error);
    }
  }
}

async function testSmartRecommendation() {
  console.log("\n🧠 Testing Smart Recommendation Engine...\n");
  
  const testTasks = [
    "Create a presentation for a product demo",
    "Analyze customer feedback data", 
    "Build a responsive web interface",
    "Automate code testing workflow",
    "Design user interface mockups"
  ];
  
  for (const taskName of testTasks) {
    console.log(`\n🎯 Testing task: "${taskName}"`);
    console.log("=" .repeat(60));
    
    try {
      const result = await smartRecommendationEngine.getSmartRecommendationWithRAG(
        taskName,
        undefined,
        {
          userId: "test-user",
          sessionId: "test-session", 
          language: "ko"
        },
        {
          enableRAG: true,
          enableAdaptive: true,
          fallbackToLegacy: true
        }
      );
      
      if (!result.toolId) {
        console.log("❌ No tool recommendation");
        continue;
      }
      
      console.log(`✅ Recommended Tool: ${result.toolName}`);
      console.log(`   Final Score: ${result.finalScore.toFixed(4)}`);
      console.log(`   Similarity: ${result.similarity.toFixed(4)}`);
      console.log(`   Quality Score: ${result.qualityScore.toFixed(4)}`);
      console.log(`   Task Type: ${result.taskType}`);
      console.log(`   Search Strategy: ${result.searchStrategy}`);
      console.log(`   Search Duration: ${result.searchDuration}ms`);
      console.log(`   Reason: ${result.reason.substring(0, 100)}...`);
      
    } catch (error) {
      console.error(`❌ Error testing "${taskName}":`, error);
    }
  }
}

async function main() {
  console.log("🚀 Advanced Hybrid Search Test Suite");
  console.log("====================================\n");
  
  try {
    await testAdvancedHybridSearch();
    await testSmartRecommendation();
    
    console.log("\n🎉 All tests completed!");
    
  } catch (error) {
    console.error("💥 Test suite failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}