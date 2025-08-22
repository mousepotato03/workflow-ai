import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { getEnvVar } from "@/lib/config/env-validation";
import { logger } from "@/lib/logger/structured-logger";
import { webSearchService } from "./web-search-service";

interface GuideSection {
  title: string;
  content: string;
  steps?: string[];
}

interface ToolGuide {
  id: string;
  toolName: string;
  taskContext: string;
  summary: string;
  sections: GuideSection[];
  sourceUrls: string[];
  confidenceScore: number;
  language: string;
  createdAt: Date;
  expiresAt: Date;
}

interface GenerateGuideOptions {
  toolName: string;
  toolUrl?: string;
  taskContext: string;
  language?: string;
  userContext?: any;
}

// Initialize Gemini model
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0.3, // Slightly higher for more creative guide generation
  apiKey: getEnvVar("GOOGLE_API_KEY"),
});

export class GuideGenerationService {
  private static instance: GuideGenerationService;

  private constructor() {}

  static getInstance(): GuideGenerationService {
    if (!GuideGenerationService.instance) {
      GuideGenerationService.instance = new GuideGenerationService();
    }
    return GuideGenerationService.instance;
  }

  /**
   * Main method to generate a comprehensive tool usage guide
   */
  async generateToolGuide(options: GenerateGuideOptions): Promise<ToolGuide> {
    const startTime = Date.now();
    const { toolName, taskContext, language = "en", userContext } = options;

    logger.info("Starting tool guide generation", {
      toolName,
      taskContext,
      language,
      ...userContext,
    });

    try {
      // Step 1: Search for relevant web content
      const searchResult = await webSearchService.searchToolGuides(
        toolName,
        taskContext,
        language
      );

      logger.info("Web search completed for guide generation", {
        toolName,
        resultCount: searchResult.results.length,
        searchTime: searchResult.searchTime,
      });

      // Step 2: Extract content from top search results
      const extractedContent = await this.extractContentFromResults(
        searchResult.results.slice(0, 3) // Use top 3 results
      );

      // Step 3: Generate structured guide using AI
      const guideContent = await this.generateStructuredGuide({
        toolName,
        taskContext,
        webContent: extractedContent,
        language,
      });

      // Step 4: Calculate confidence score based on available data
      const confidenceScore = this.calculateConfidenceScore(
        searchResult.results.length,
        extractedContent.length,
        guideContent.sections.length
      );

      const guide: ToolGuide = {
        id: crypto.randomUUID(),
        toolName,
        taskContext,
        summary: guideContent.summary,
        sections: guideContent.sections,
        sourceUrls: searchResult.results.map((r) => r.link),
        confidenceScore,
        language,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      const generationTime = Date.now() - startTime;

      logger.info("Tool guide generation completed", {
        toolName,
        taskContext,
        sectionsCount: guide.sections.length,
        confidenceScore: guide.confidenceScore,
        generationTime,
        ...userContext,
      });

      return guide;
    } catch (error) {
      const generationTime = Date.now() - startTime;

      logger.error("Tool guide generation failed", {
        toolName,
        taskContext,
        error: error instanceof Error ? error.message : String(error),
        generationTime,
        ...userContext,
      });

      // Return fallback guide
      return this.generateFallbackGuide(options);
    }
  }

  /**
   * Extract content from search results
   */
  private async extractContentFromResults(results: any[]): Promise<string> {
    const contentPieces: string[] = [];

    for (const result of results) {
      try {
        // Use snippet as primary content, try to extract from URL as fallback
        if (result.snippet && result.snippet.length > 50) {
          contentPieces.push(`${result.title}\n${result.snippet}`);
        }

        // Optionally extract full content from URL (limited to prevent timeouts)
        if (contentPieces.length < 2 && result.link) {
          const extractedContent = await webSearchService.extractWebContent(
            result.link
          );
          if (extractedContent && extractedContent.length > 100) {
            contentPieces.push(
              `${result.title}\n${extractedContent.substring(0, 1000)}`
            );
          }
        }
      } catch (error) {
        logger.warn("Failed to extract content from result", {
          url: result.link,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return contentPieces.join("\n\n---\n\n");
  }

  /**
   * Generate structured guide using AI
   */
  private async generateStructuredGuide(params: {
    toolName: string;
    taskContext: string;
    webContent: string;
    language: string;
  }): Promise<{ summary: string; sections: GuideSection[] }> {
    const prompt = PromptTemplate.fromTemplate(`
Please write a detailed and practical guide for users to use the "{toolName}" tool for "{taskContext}" tasks.

Refer to the following information collected from the web:
{webContent}

Please write the guide in the following format:

## Summary
[Explain the main features of the tool and how it helps with this task in 2-3 sentences]

## Prerequisites
- [List necessary prerequisites by item]

## Step-by-Step Usage
1. [Describe the first step specifically]
2. [Describe the second step specifically]
3. [Continue...]

## Key Feature Utilization
- [Core features particularly useful for the task]
- [Explain how to utilize each feature]

## Precautions and Tips
- [Points to be careful about when using]
- [Tips for efficient use]

## Expected Results
[Describe the results you can get by following this guide]

Important: Write with specific and actionable content tailored to the user's "{taskContext}" task context.
Provide specific steps that can actually be followed rather than general explanations.
`);

    const chain = RunnableSequence.from([
      prompt,
      model,
      new StringOutputParser(),
    ]);

    const response = await chain.invoke({
      toolName: params.toolName,
      taskContext: params.taskContext,
      webContent:
        params.webContent ||
        `Could not find web information about ${params.toolName}, providing a general guide.`,
    });

    return this.parseGuideResponse(response);
  }

  /**
   * Parse AI response into structured guide format
   */
  private parseGuideResponse(response: string): {
    summary: string;
    sections: GuideSection[];
  } {
    const lines = response.split("\n");
    const sections: GuideSection[] = [];
    let currentSection: GuideSection | null = null;
    let summary = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Extract summary
      if (line.includes("## 요약") && i + 1 < lines.length) {
        const summaryLines = [];
        let j = i + 1;
        while (
          j < lines.length &&
          !lines[j].startsWith("##") &&
          !lines[j].startsWith("#")
        ) {
          if (lines[j].trim()) {
            summaryLines.push(lines[j].trim());
          }
          j++;
        }
        summary = summaryLines.join(" ");
      }

      // Parse sections
      if (line.startsWith("## ") && !line.includes("요약")) {
        // Save previous section
        if (currentSection) {
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          title: line.replace("## ", ""),
          content: "",
          steps: [],
        };
      } else if (currentSection && line) {
        // Add content to current section
        if (line.match(/^\d+\.\s/)) {
          // This is a numbered step
          currentSection.steps = currentSection.steps || [];
          currentSection.steps.push(line.replace(/^\d+\.\s/, ""));
        } else if (line.startsWith("- ") || line.startsWith("• ")) {
          // This is a bullet point
          currentSection.content += (currentSection.content ? "\n" : "") + line;
        } else {
          // Regular content
          currentSection.content += (currentSection.content ? "\n" : "") + line;
        }
      }
    }

    // Don't forget the last section
    if (currentSection) {
      sections.push(currentSection);
    }

    // Fallback sections if parsing failed
    if (sections.length === 0) {
      sections.push({
        title: "Usage Guide",
        content: response,
        steps: [],
      });
    }

    return {
      summary: summary || "Provides a guide for tool usage.",
      sections,
    };
  }

  /**
   * Calculate confidence score based on available data quality
   */
  private calculateConfidenceScore(
    searchResultCount: number,
    contentLength: number,
    sectionsCount: number
  ): number {
    let score = 0.3; // Base score

    // Search results quality (max +0.3)
    score += Math.min(searchResultCount * 0.1, 0.3);

    // Content availability (max +0.2)
    score += Math.min((contentLength / 1000) * 0.2, 0.2);

    // Guide structure quality (max +0.2)
    score += Math.min(sectionsCount * 0.05, 0.2);

    return Math.min(Math.max(score, 0.3), 1.0); // Keep between 0.3 and 1.0
  }

  /**
   * Generate fallback guide when main generation fails
   */
  private generateFallbackGuide(options: GenerateGuideOptions): ToolGuide {
    const { toolName, taskContext, language = "en" } = options;

    const fallbackSections: GuideSection[] = [
      {
        title: "Basic Usage",
        content: `This guide covers the basic methods for using ${toolName} to perform ${taskContext} tasks.`,
        steps: [
          `Access the ${toolName} website or app.`,
          "Sign up for an account if required.",
          `Find and start the feature related to ${taskContext}.`,
          "Proceed step by step and refer to help documentation when needed.",
        ],
      },
      {
        title: "Recommendations",
        content:
          "For more detailed usage instructions, please refer to official documentation or tutorials.",
        steps: [],
      },
    ];

    return {
      id: crypto.randomUUID(),
      toolName,
      taskContext,
      summary: `This is a basic guide for ${taskContext} tasks using ${toolName}.`,
      sections: fallbackSections,
      sourceUrls: [],
      confidenceScore: 0.3, // Low confidence for fallback
      language,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  /**
   * Generate quick usage tip (lighter version of full guide)
   */
  async generateQuickTip(
    toolName: string,
    taskContext: string,
    language = "en"
  ): Promise<string> {
    try {
      const prompt = PromptTemplate.fromTemplate(`
        Please briefly tell the user the most important tip when using "{toolName}" for "{taskContext}" tasks in 2-3 sentences.
        Write practical and immediately applicable content.
      `);

      const chain = RunnableSequence.from([
        prompt,
        model,
        new StringOutputParser(),
      ]);
      const response = await chain.invoke({ toolName, taskContext });

      return response.trim();
    } catch (error) {
      logger.error("Quick tip generation failed", {
        toolName,
        taskContext,
        error: error instanceof Error ? error.message : String(error),
      });

      return `Start using ${toolName} for ${taskContext} tasks. Please refer to official documentation or tutorials for more detailed information.`;
    }
  }
}

export const guideGenerationService = GuideGenerationService.getInstance();
export type { ToolGuide, GuideSection, GenerateGuideOptions };
