/**
 * Test Data Scenarios for Demonstrating RAG Enhancement Benefits
 * 
 * This file contains carefully crafted test scenarios designed to showcase
 * the specific advantages of RAG-enhanced tool matching over traditional
 * keyword-based or simple similarity search approaches.
 * 
 * Key Benefits Demonstrated:
 * - Contextual understanding of complex queries
 * - Domain-specific knowledge application
 * - Multi-intent recognition and handling
 * - Learning from user patterns and feedback
 * - Semantic understanding beyond keywords
 */

export interface TestScenario {
  id: string;
  category: string;
  name: string;
  description: string;
  query: string;
  expectedRagBehavior: {
    shouldUnderstand: string[];
    recommendationQuality: 'high' | 'medium' | 'low';
    contextFactors: string[];
    semanticConcepts: string[];
  };
  expectedLegacyBehavior: {
    likelyMisunderstanding: string[];
    limitedContext: boolean;
    keywordReliance: string[];
  };
  successCriteria: {
    ragMinimumScore: number;
    improvementThreshold: number;
    specificRequirements: string[];
  };
  metadata: {
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    domain: string[];
    intentComplexity: number; // 1-5 scale
  };
}

export interface BenchmarkDataset {
  name: string;
  description: string;
  scenarios: TestScenario[];
  expectedOverallImprovement: number;
  focusAreas: string[];
}

/**
 * Contextual Understanding Test Scenarios
 */
export const ContextualUnderstandingScenarios: TestScenario[] = [
  {
    id: "context-001",
    category: "Contextual Understanding",
    name: "Mobile Banking App Design with Accessibility",
    description: "Complex design query requiring understanding of mobile, banking domain, and accessibility requirements",
    query: "I need to design a mobile banking app interface that's accessible for visually impaired users and complies with financial regulations",
    expectedRagBehavior: {
      shouldUnderstand: [
        "Mobile-specific design constraints",
        "Banking/financial domain requirements", 
        "Accessibility standards (WCAG)",
        "Regulatory compliance needs",
        "User interface design principles"
      ],
      recommendationQuality: "high",
      contextFactors: ["mobile", "banking", "accessibility", "compliance", "UI/UX"],
      semanticConcepts: ["inclusive design", "financial regulations", "mobile usability"]
    },
    expectedLegacyBehavior: {
      likelyMisunderstanding: [
        "May focus only on 'design' keyword",
        "Might miss banking-specific requirements",
        "Could overlook accessibility needs"
      ],
      limitedContext: true,
      keywordReliance: ["design", "app", "interface"]
    },
    successCriteria: {
      ragMinimumScore: 0.85,
      improvementThreshold: 0.4,
      specificRequirements: [
        "Recommends accessibility-aware design tools",
        "Suggests compliance-focused solutions",
        "Considers mobile-first design principles"
      ]
    },
    metadata: {
      difficulty: "advanced",
      domain: ["design", "finance", "accessibility"],
      intentComplexity: 5
    }
  },
  {
    id: "context-002", 
    category: "Contextual Understanding",
    name: "E-commerce Analytics with Real-time Processing",
    description: "Analytics query requiring understanding of e-commerce metrics and real-time processing needs",
    query: "Create dashboards to track conversion rates, cart abandonment, and customer lifetime value with real-time updates for Black Friday traffic",
    expectedRagBehavior: {
      shouldUnderstand: [
        "E-commerce specific KPIs",
        "Real-time processing requirements",
        "High-traffic event handling",
        "Multiple metric correlation",
        "Dashboard visualization needs"
      ],
      recommendationQuality: "high",
      contextFactors: ["e-commerce", "real-time", "high-traffic", "multiple-metrics", "dashboards"],
      semanticConcepts: ["conversion optimization", "customer analytics", "real-time monitoring"]
    },
    expectedLegacyBehavior: {
      likelyMisunderstanding: [
        "Generic analytics tools without e-commerce focus",
        "May miss real-time requirements",
        "Could ignore high-traffic considerations"
      ],
      limitedContext: true,
      keywordReliance: ["dashboard", "analytics", "track"]
    },
    successCriteria: {
      ragMinimumScore: 0.80,
      improvementThreshold: 0.35,
      specificRequirements: [
        "Recommends e-commerce focused analytics tools",
        "Prioritizes real-time capabilities",
        "Considers high-traffic scalability"
      ]
    },
    metadata: {
      difficulty: "advanced",
      domain: ["analytics", "e-commerce", "real-time"],
      intentComplexity: 4
    }
  },
  {
    id: "context-003",
    category: "Contextual Understanding", 
    name: "Remote Team Development Workflow",
    description: "Development workflow query considering remote collaboration and specific technology stack",
    query: "Set up development workflow for distributed React team with automated testing, code review, and deployment for microservices architecture",
    expectedRagBehavior: {
      shouldUnderstand: [
        "Remote/distributed team needs",
        "React-specific development tools",
        "Automated testing requirements",
        "Code review processes",
        "Microservices deployment patterns"
      ],
      recommendationQuality: "high",
      contextFactors: ["remote-team", "react", "automation", "microservices", "workflow"],
      semanticConcepts: ["distributed development", "CI/CD pipeline", "team collaboration"]
    },
    expectedLegacyBehavior: {
      likelyMisunderstanding: [
        "Generic development tools",
        "May miss remote collaboration aspects",
        "Could ignore microservices specifics"
      ],
      limitedContext: true,
      keywordReliance: ["development", "testing", "deployment"]
    },
    successCriteria: {
      ragMinimumScore: 0.82,
      improvementThreshold: 0.38,
      specificRequirements: [
        "Recommends remote-friendly development tools",
        "Includes React ecosystem tools",
        "Addresses microservices deployment needs"
      ]
    },
    metadata: {
      difficulty: "intermediate",
      domain: ["development", "collaboration", "devops"],
      intentComplexity: 4
    }
  }
];

/**
 * Domain-Specific Knowledge Test Scenarios
 */
export const DomainSpecificScenarios: TestScenario[] = [
  {
    id: "domain-001",
    category: "Domain-Specific Knowledge",
    name: "Healthcare Data Pipeline with HIPAA Compliance",
    description: "Healthcare analytics requiring understanding of HIPAA, PHI handling, and medical data processing",
    query: "Build a data pipeline to analyze patient outcomes while ensuring HIPAA compliance and secure PHI handling with audit trails",
    expectedRagBehavior: {
      shouldUnderstand: [
        "HIPAA compliance requirements",
        "PHI (Protected Health Information) handling",
        "Medical data security standards",
        "Audit trail requirements",
        "Healthcare analytics specifics"
      ],
      recommendationQuality: "high",
      contextFactors: ["healthcare", "HIPAA", "PHI", "compliance", "security", "audit"],
      semanticConcepts: ["healthcare privacy", "medical data governance", "compliance monitoring"]
    },
    expectedLegacyBehavior: {
      likelyMisunderstanding: [
        "Generic data pipeline tools",
        "May miss HIPAA requirements",
        "Could overlook PHI security needs"
      ],
      limitedContext: true,
      keywordReliance: ["data", "pipeline", "analyze"]
    },
    successCriteria: {
      ragMinimumScore: 0.88,
      improvementThreshold: 0.45,
      specificRequirements: [
        "Prioritizes HIPAA-compliant solutions",
        "Emphasizes PHI security features",
        "Includes audit and monitoring capabilities"
      ]
    },
    metadata: {
      difficulty: "advanced",
      domain: ["healthcare", "compliance", "data-engineering"],
      intentComplexity: 5
    }
  },
  {
    id: "domain-002",
    category: "Domain-Specific Knowledge",
    name: "Financial Risk Modeling with Regulatory Reporting",
    description: "Financial risk analysis requiring understanding of Basel III, stress testing, and regulatory reporting",
    query: "Implement Monte Carlo risk simulations for credit portfolio with Basel III capital calculations and automated regulatory reporting",
    expectedRagBehavior: {
      shouldUnderstand: [
        "Monte Carlo simulation methods",
        "Credit risk modeling concepts",
        "Basel III regulatory framework",
        "Capital adequacy calculations",
        "Regulatory reporting requirements"
      ],
      recommendationQuality: "high",
      contextFactors: ["finance", "risk-modeling", "basel-iii", "monte-carlo", "regulatory"],
      semanticConcepts: ["financial risk management", "regulatory compliance", "quantitative finance"]
    },
    expectedLegacyBehavior: {
      likelyMisunderstanding: [
        "Generic simulation tools",
        "May miss Basel III specifics",
        "Could overlook regulatory aspects"
      ],
      limitedContext: true,
      keywordReliance: ["risk", "simulation", "calculations"]
    },
    successCriteria: {
      ragMinimumScore: 0.86,
      improvementThreshold: 0.42,
      specificRequirements: [
        "Recommends quantitative finance tools",
        "Addresses Basel III requirements",
        "Includes regulatory reporting features"
      ]
    },
    metadata: {
      difficulty: "advanced",
      domain: ["finance", "risk-management", "regulatory"],
      intentComplexity: 5
    }
  },
  {
    id: "domain-003",
    category: "Domain-Specific Knowledge",
    name: "IoT Manufacturing Monitoring with Predictive Maintenance",
    description: "Industrial IoT scenario requiring understanding of OT/IT convergence, predictive analytics, and manufacturing processes",
    query: "Monitor industrial equipment sensors for predictive maintenance using edge computing with OT/IT security and real-time anomaly detection",
    expectedRagBehavior: {
      shouldUnderstand: [
        "Industrial IoT architecture",
        "OT (Operational Technology) vs IT security",
        "Edge computing requirements",
        "Predictive maintenance algorithms",
        "Manufacturing equipment monitoring"
      ],
      recommendationQuality: "high",
      contextFactors: ["IoT", "manufacturing", "edge-computing", "predictive-maintenance", "OT-security"],
      semanticConcepts: ["industrial automation", "predictive analytics", "edge intelligence"]
    },
    expectedLegacyBehavior: {
      likelyMisunderstanding: [
        "Generic IoT tools",
        "May miss OT security requirements",
        "Could overlook manufacturing specifics"
      ],
      limitedContext: true,
      keywordReliance: ["IoT", "sensors", "monitoring"]
    },
    successCriteria: {
      ragMinimumScore: 0.84,
      improvementThreshold: 0.40,
      specificRequirements: [
        "Recommends industrial IoT platforms",
        "Addresses OT/IT security convergence",
        "Includes predictive maintenance capabilities"
      ]
    },
    metadata: {
      difficulty: "advanced",
      domain: ["IoT", "manufacturing", "predictive-analytics"],
      intentComplexity: 4
    }
  }
];

/**
 * Multi-Intent Recognition Test Scenarios
 */
export const MultiIntentScenarios: TestScenario[] = [
  {
    id: "multi-001",
    category: "Multi-Intent Recognition",
    name: "Data Pipeline with Visualization and Alerting",
    description: "Query containing multiple intents: data processing, visualization, and monitoring/alerting",
    query: "I need to extract data from multiple APIs, clean and transform it, create interactive dashboards, and set up alerts when KPIs drop below thresholds",
    expectedRagBehavior: {
      shouldUnderstand: [
        "Data extraction from APIs",
        "ETL/data transformation processes",
        "Interactive dashboard creation",
        "Alerting and monitoring setup",
        "KPI threshold management"
      ],
      recommendationQuality: "high",
      contextFactors: ["API-integration", "ETL", "dashboards", "alerting", "KPIs"],
      semanticConcepts: ["data pipeline", "business intelligence", "proactive monitoring"]
    },
    expectedLegacyBehavior: {
      likelyMisunderstanding: [
        "May focus on single intent (likely dashboards)",
        "Could miss alerting requirements",
        "Might not connect data flow steps"
      ],
      limitedContext: true,
      keywordReliance: ["data", "dashboard", "alerts"]
    },
    successCriteria: {
      ragMinimumScore: 0.75,
      improvementThreshold: 0.30,
      specificRequirements: [
        "Recognizes all four intents",
        "Suggests integrated workflow solutions",
        "Addresses end-to-end data pipeline"
      ]
    },
    metadata: {
      difficulty: "intermediate",
      domain: ["data-engineering", "analytics", "monitoring"],
      intentComplexity: 4
    }
  },
  {
    id: "multi-002",
    category: "Multi-Intent Recognition",
    name: "Design System with Documentation and Implementation",
    description: "Query covering design system creation, documentation, and developer implementation",
    query: "Create a comprehensive design system with reusable components, maintain design tokens documentation, and provide developer tools for implementation",
    expectedRagBehavior: {
      shouldUnderstand: [
        "Design system architecture",
        "Reusable component libraries",
        "Design tokens management",
        "Documentation maintenance",
        "Developer implementation tools"
      ],
      recommendationQuality: "high",
      contextFactors: ["design-system", "components", "documentation", "design-tokens", "developer-tools"],
      semanticConcepts: ["design operations", "design-developer handoff", "scalable design"]
    },
    expectedLegacyBehavior: {
      likelyMisunderstanding: [
        "May focus only on design tools",
        "Could miss documentation aspects",
        "Might overlook developer workflow"
      ],
      limitedContext: true,
      keywordReliance: ["design", "components", "documentation"]
    },
    successCriteria: {
      ragMinimumScore: 0.78,
      improvementThreshold: 0.32,
      specificRequirements: [
        "Addresses design system creation",
        "Includes documentation tools",
        "Considers developer implementation"
      ]
    },
    metadata: {
      difficulty: "intermediate",
      domain: ["design", "documentation", "development"],
      intentComplexity: 3
    }
  }
];

/**
 * Semantic Understanding Test Scenarios
 */
export const SemanticUnderstandingScenarios: TestScenario[] = [
  {
    id: "semantic-001",
    category: "Semantic Understanding",
    name: "Collaborative Innovation Workshop",
    description: "Query using high-level concepts that require semantic understanding beyond literal keywords",
    query: "Facilitate breakthrough thinking sessions to unlock creative solutions for complex business challenges with diverse stakeholder engagement",
    expectedRagBehavior: {
      shouldUnderstand: [
        "Innovation workshop methodologies",
        "Creative problem-solving frameworks",
        "Stakeholder engagement strategies",
        "Facilitation tools and techniques",
        "Collaborative brainstorming approaches"
      ],
      recommendationQuality: "high",
      contextFactors: ["innovation", "facilitation", "creativity", "collaboration", "problem-solving"],
      semanticConcepts: ["design thinking", "innovation management", "collaborative workshops"]
    },
    expectedLegacyBehavior: {
      likelyMisunderstanding: [
        "May interpret as generic meeting tools",
        "Could miss innovation methodology aspects",
        "Might not understand facilitation context"
      ],
      limitedContext: true,
      keywordReliance: ["workshop", "business", "solutions"]
    },
    successCriteria: {
      ragMinimumScore: 0.70,
      improvementThreshold: 0.35,
      specificRequirements: [
        "Recommends innovation facilitation tools",
        "Understands workshop methodology context",
        "Addresses stakeholder collaboration needs"
      ]
    },
    metadata: {
      difficulty: "intermediate",
      domain: ["innovation", "facilitation", "collaboration"],
      intentComplexity: 3
    }
  },
  {
    id: "semantic-002",
    category: "Semantic Understanding",
    name: "Customer Journey Optimization",
    description: "Query requiring understanding of customer experience concepts and optimization strategies",
    query: "Optimize touchpoint experiences across the customer lifecycle to reduce friction and enhance satisfaction while measuring emotional engagement",
    expectedRagBehavior: {
      shouldUnderstand: [
        "Customer journey mapping concepts",
        "Touchpoint optimization strategies",
        "Friction reduction techniques",
        "Customer satisfaction measurement",
        "Emotional engagement tracking"
      ],
      recommendationQuality: "high",
      contextFactors: ["customer-journey", "touchpoints", "optimization", "satisfaction", "engagement"],
      semanticConcepts: ["customer experience", "journey analytics", "emotional intelligence"]
    },
    expectedLegacyBehavior: {
      likelyMisunderstanding: [
        "May suggest generic analytics tools",
        "Could miss customer experience focus",
        "Might not understand journey mapping"
      ],
      limitedContext: true,
      keywordReliance: ["customer", "optimize", "measure"]
    },
    successCriteria: {
      ragMinimumScore: 0.72,
      improvementThreshold: 0.38,
      specificRequirements: [
        "Recommends CX optimization tools",
        "Understands journey mapping context",
        "Addresses emotional engagement measurement"
      ]
    },
    metadata: {
      difficulty: "intermediate",
      domain: ["customer-experience", "analytics", "optimization"],
      intentComplexity: 3
    }
  }
];

/**
 * Edge Case and Robustness Test Scenarios
 */
export const EdgeCaseScenarios: TestScenario[] = [
  {
    id: "edge-001",
    category: "Edge Cases",
    name: "Ambiguous Technology Query",
    description: "Intentionally vague query to test clarification and disambiguation capabilities",
    query: "cloud thing for data",
    expectedRagBehavior: {
      shouldUnderstand: [
        "Query is highly ambiguous",
        "Needs clarification on specific requirements",
        "Multiple possible interpretations exist"
      ],
      recommendationQuality: "medium",
      contextFactors: ["cloud", "data", "ambiguous"],
      semanticConcepts: ["cloud computing", "data management"]
    },
    expectedLegacyBehavior: {
      likelyMisunderstanding: [
        "May return random cloud or data tools",
        "No disambiguation attempt",
        "Generic keyword matching"
      ],
      limitedContext: true,
      keywordReliance: ["cloud", "data"]
    },
    successCriteria: {
      ragMinimumScore: 0.40,
      improvementThreshold: 0.25,
      specificRequirements: [
        "Recognizes query ambiguity",
        "Provides clarifying questions or categories",
        "Offers multiple interpretation options"
      ]
    },
    metadata: {
      difficulty: "beginner",
      domain: ["cloud", "data"],
      intentComplexity: 1
    }
  },
  {
    id: "edge-002",
    category: "Edge Cases",
    name: "Non-English Technical Terms",
    description: "Query mixing languages or using technical jargon from different regions",
    query: "Implementar CI/CD pipeline avec Docker für microservices deployment",
    expectedRagBehavior: {
      shouldUnderstand: [
        "Mixed language query (Spanish/French/German/English)",
        "CI/CD implementation intent",
        "Docker containerization",
        "Microservices architecture"
      ],
      recommendationQuality: "medium",
      contextFactors: ["multilingual", "CI/CD", "docker", "microservices"],
      semanticConcepts: ["continuous integration", "containerization", "microservices"]
    },
    expectedLegacyBehavior: {
      likelyMisunderstanding: [
        "May fail on non-English terms",
        "Could miss technical context",
        "Likely poor handling of mixed languages"
      ],
      limitedContext: true,
      keywordReliance: ["CI/CD", "Docker", "microservices"]
    },
    successCriteria: {
      ragMinimumScore: 0.55,
      improvementThreshold: 0.30,
      specificRequirements: [
        "Handles multilingual technical terms",
        "Recognizes CI/CD and containerization concepts",
        "Provides relevant DevOps tools"
      ]
    },
    metadata: {
      difficulty: "intermediate",
      domain: ["devops", "multilingual"],
      intentComplexity: 2
    }
  }
];

/**
 * Benchmark Datasets
 */
export const RagBenefitsBenchmarks: BenchmarkDataset[] = [
  {
    name: "Contextual Understanding Benchmark",
    description: "Evaluates RAG system's ability to understand complex contextual requirements",
    scenarios: ContextualUnderstandingScenarios,
    expectedOverallImprovement: 0.40,
    focusAreas: ["context-awareness", "domain-understanding", "requirement-analysis"]
  },
  {
    name: "Domain Expertise Benchmark", 
    description: "Tests RAG system's knowledge of specialized domains and terminology",
    scenarios: DomainSpecificScenarios,
    expectedOverallImprovement: 0.45,
    focusAreas: ["domain-knowledge", "specialized-terminology", "compliance-awareness"]
  },
  {
    name: "Multi-Intent Recognition Benchmark",
    description: "Evaluates ability to recognize and handle multiple intents in complex queries",
    scenarios: MultiIntentScenarios,
    expectedOverallImprovement: 0.35,
    focusAreas: ["intent-recognition", "workflow-understanding", "integrated-solutions"]
  },
  {
    name: "Semantic Understanding Benchmark",
    description: "Tests understanding of high-level concepts and semantic relationships",
    scenarios: SemanticUnderstandingScenarios,
    expectedOverallImprovement: 0.38,
    focusAreas: ["semantic-analysis", "concept-understanding", "contextual-inference"]
  },
  {
    name: "Robustness and Edge Cases Benchmark",
    description: "Evaluates system robustness with ambiguous, mixed-language, and edge case queries",
    scenarios: EdgeCaseScenarios,
    expectedOverallImprovement: 0.25,
    focusAreas: ["robustness", "error-handling", "disambiguation"]
  }
];

/**
 * Comprehensive Test Dataset
 */
export const ComprehensiveRagBenchmark: BenchmarkDataset = {
  name: "Comprehensive RAG Enhancement Benchmark",
  description: "Complete evaluation of RAG system benefits across all categories",
  scenarios: [
    ...ContextualUnderstandingScenarios,
    ...DomainSpecificScenarios,
    ...MultiIntentScenarios,
    ...SemanticUnderstandingScenarios,
    ...EdgeCaseScenarios
  ],
  expectedOverallImprovement: 0.37, // Average across all categories
  focusAreas: [
    "contextual-understanding",
    "domain-expertise", 
    "multi-intent-recognition",
    "semantic-analysis",
    "robustness",
    "user-experience",
    "recommendation-quality"
  ]
};

/**
 * Utility functions for test scenario execution
 */
export class RagBenefitsTestDataUtil {
  
  /**
   * Get test scenarios by category
   */
  static getScenariosByCategory(category: string): TestScenario[] {
    return ComprehensiveRagBenchmark.scenarios.filter(s => s.category === category);
  }

  /**
   * Get scenarios by difficulty level
   */
  static getScenariosByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): TestScenario[] {
    return ComprehensiveRagBenchmark.scenarios.filter(s => s.metadata.difficulty === difficulty);
  }

  /**
   * Get scenarios by domain
   */
  static getScenariosByDomain(domain: string): TestScenario[] {
    return ComprehensiveRagBenchmark.scenarios.filter(s => s.metadata.domain.includes(domain));
  }

  /**
   * Get high-complexity scenarios for advanced testing
   */
  static getHighComplexityScenarios(): TestScenario[] {
    return ComprehensiveRagBenchmark.scenarios.filter(s => s.metadata.intentComplexity >= 4);
  }

  /**
   * Generate evaluation criteria for a scenario
   */
  static generateEvaluationCriteria(scenario: TestScenario): {
    contextualFactorScore: (recognizedFactors: string[]) => number;
    semanticUnderstandingScore: (concepts: string[]) => number;
    improvementScore: (ragScore: number, legacyScore: number) => number;
  } {
    return {
      contextualFactorScore: (recognizedFactors: string[]) => {
        const expectedFactors = scenario.expectedRagBehavior.contextFactors;
        const matches = recognizedFactors.filter(factor => 
          expectedFactors.some(expected => 
            expected.toLowerCase().includes(factor.toLowerCase()) ||
            factor.toLowerCase().includes(expected.toLowerCase())
          )
        ).length;
        return matches / expectedFactors.length;
      },
      
      semanticUnderstandingScore: (concepts: string[]) => {
        const expectedConcepts = scenario.expectedRagBehavior.semanticConcepts;
        const matches = concepts.filter(concept =>
          expectedConcepts.some(expected =>
            expected.toLowerCase().includes(concept.toLowerCase()) ||
            concept.toLowerCase().includes(expected.toLowerCase())
          )
        ).length;
        return matches / expectedConcepts.length;
      },
      
      improvementScore: (ragScore: number, legacyScore: number) => {
        const improvement = ragScore - legacyScore;
        const meetsThreshold = improvement >= scenario.successCriteria.improvementThreshold;
        const meetsMinimum = ragScore >= scenario.successCriteria.ragMinimumScore;
        
        return (improvement / scenario.successCriteria.improvementThreshold) * 
               (meetsThreshold && meetsMinimum ? 1.0 : 0.5);
      }
    };
  }

  /**
   * Validate test scenario structure
   */
  static validateScenario(scenario: TestScenario): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!scenario.id || scenario.id.length === 0) {
      errors.push("Scenario must have a valid ID");
    }
    
    if (!scenario.query || scenario.query.length < 10) {
      errors.push("Scenario must have a meaningful query (at least 10 characters)");
    }
    
    if (!scenario.expectedRagBehavior.contextFactors || scenario.expectedRagBehavior.contextFactors.length === 0) {
      errors.push("Scenario must define expected contextual factors");
    }
    
    if (scenario.successCriteria.ragMinimumScore < 0 || scenario.successCriteria.ragMinimumScore > 1) {
      errors.push("RAG minimum score must be between 0 and 1");
    }
    
    if (scenario.metadata.intentComplexity < 1 || scenario.metadata.intentComplexity > 5) {
      errors.push("Intent complexity must be between 1 and 5");
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate summary statistics for benchmark dataset
   */
  static generateBenchmarkStats(benchmark: BenchmarkDataset) {
    const scenarios = benchmark.scenarios;
    
    return {
      totalScenarios: scenarios.length,
      categoriesCovered: [...new Set(scenarios.map(s => s.category))].length,
      domainsCovered: [...new Set(scenarios.flatMap(s => s.metadata.domain))].length,
      averageComplexity: scenarios.reduce((sum, s) => sum + s.metadata.intentComplexity, 0) / scenarios.length,
      difficultyDistribution: {
        beginner: scenarios.filter(s => s.metadata.difficulty === 'beginner').length,
        intermediate: scenarios.filter(s => s.metadata.difficulty === 'intermediate').length,
        advanced: scenarios.filter(s => s.metadata.difficulty === 'advanced').length
      },
      expectedImprovement: benchmark.expectedOverallImprovement,
      focusAreas: benchmark.focusAreas
    };
  }
}

export default {
  ComprehensiveRagBenchmark,
  RagBenefitsBenchmarks,
  RagBenefitsTestDataUtil,
  ContextualUnderstandingScenarios,
  DomainSpecificScenarios,
  MultiIntentScenarios,
  SemanticUnderstandingScenarios,
  EdgeCaseScenarios
};