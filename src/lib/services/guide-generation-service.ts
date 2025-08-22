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
    const { toolName, taskContext, language = "ko", userContext } = options;
    
    logger.info("Starting tool guide generation", {
      toolName,
      taskContext,
      language,
      ...userContext
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
        searchTime: searchResult.searchTime
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
        language
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
        sourceUrls: searchResult.results.map(r => r.link),
        confidenceScore,
        language,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };

      const generationTime = Date.now() - startTime;
      
      logger.info("Tool guide generation completed", {
        toolName,
        taskContext,
        sectionsCount: guide.sections.length,
        confidenceScore: guide.confidenceScore,
        generationTime,
        ...userContext
      });

      return guide;

    } catch (error) {
      const generationTime = Date.now() - startTime;
      
      logger.error("Tool guide generation failed", {
        toolName,
        taskContext,
        error: error instanceof Error ? error.message : String(error),
        generationTime,
        ...userContext
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
          const extractedContent = await webSearchService.extractWebContent(result.link);
          if (extractedContent && extractedContent.length > 100) {
            contentPieces.push(`${result.title}\n${extractedContent.substring(0, 1000)}`);
          }
        }
      } catch (error) {
        logger.warn("Failed to extract content from result", {
          url: result.link,
          error: error instanceof Error ? error.message : String(error)
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
사용자가 "{taskContext}" 작업을 위해 "{toolName}" 도구를 사용할 수 있도록 상세하고 실용적인 가이드를 작성해주세요.

다음 웹에서 수집한 정보를 참고하세요:
{webContent}

가이드는 다음 형식으로 작성해주세요:

## 요약
[도구의 주요 기능과 이 작업에 어떻게 도움이 되는지 2-3문장으로 설명]

## 준비사항
- [필요한 준비사항들을 항목별로 나열]

## 단계별 사용법
1. [첫 번째 단계를 구체적으로 설명]
2. [두 번째 단계를 구체적으로 설명]
3. [계속...]

## 주요 기능 활용
- [작업에 특히 유용한 핵심 기능들]
- [각 기능을 어떻게 활용할지 설명]

## 주의사항 및 팁
- [사용 시 주의할 점들]
- [효율적으로 사용하는 팁들]

## 예상 결과
[이 가이드를 따라 했을 때 얻을 수 있는 결과 설명]

중요: 사용자의 "{taskContext}" 작업 맥락에 맞춰 구체적이고 실행 가능한 내용으로 작성하세요.
일반적인 설명보다는 실제로 따라할 수 있는 구체적인 단계를 제공하세요.
`);

    const chain = RunnableSequence.from([prompt, model, new StringOutputParser()]);

    const response = await chain.invoke({
      toolName: params.toolName,
      taskContext: params.taskContext,
      webContent: params.webContent || `${params.toolName}에 대한 웹 정보를 찾을 수 없어 일반적인 가이드를 제공합니다.`
    });

    return this.parseGuideResponse(response);
  }

  /**
   * Parse AI response into structured guide format
   */
  private parseGuideResponse(response: string): { summary: string; sections: GuideSection[] } {
    const lines = response.split('\n');
    const sections: GuideSection[] = [];
    let currentSection: GuideSection | null = null;
    let summary = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Extract summary
      if (line.includes('## 요약') && i + 1 < lines.length) {
        const summaryLines = [];
        let j = i + 1;
        while (j < lines.length && !lines[j].startsWith('##') && !lines[j].startsWith('#')) {
          if (lines[j].trim()) {
            summaryLines.push(lines[j].trim());
          }
          j++;
        }
        summary = summaryLines.join(' ');
      }
      
      // Parse sections
      if (line.startsWith('## ') && !line.includes('요약')) {
        // Save previous section
        if (currentSection) {
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          title: line.replace('## ', ''),
          content: '',
          steps: []
        };
      } else if (currentSection && line) {
        // Add content to current section
        if (line.match(/^\d+\.\s/)) {
          // This is a numbered step
          currentSection.steps = currentSection.steps || [];
          currentSection.steps.push(line.replace(/^\d+\.\s/, ''));
        } else if (line.startsWith('- ') || line.startsWith('• ')) {
          // This is a bullet point
          currentSection.content += (currentSection.content ? '\n' : '') + line;
        } else {
          // Regular content
          currentSection.content += (currentSection.content ? '\n' : '') + line;
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
        title: '사용 가이드',
        content: response,
        steps: []
      });
    }

    return { 
      summary: summary || '도구 사용에 대한 가이드를 제공합니다.',
      sections 
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
    score += Math.min(contentLength / 1000 * 0.2, 0.2);

    // Guide structure quality (max +0.2)
    score += Math.min(sectionsCount * 0.05, 0.2);

    return Math.min(Math.max(score, 0.3), 1.0); // Keep between 0.3 and 1.0
  }

  /**
   * Generate fallback guide when main generation fails
   */
  private generateFallbackGuide(options: GenerateGuideOptions): ToolGuide {
    const { toolName, taskContext, language = "ko" } = options;
    
    const fallbackSections: GuideSection[] = [
      {
        title: "기본 사용법",
        content: `${toolName}을 사용하여 ${taskContext} 작업을 수행하는 기본적인 방법을 안내합니다.`,
        steps: [
          `${toolName} 웹사이트나 앱에 접속합니다.`,
          "계정이 필요한 경우 회원가입을 진행합니다.",
          `${taskContext}에 관련된 기능을 찾아 시작합니다.`,
          "단계별로 진행하며 필요시 도움말을 참고합니다."
        ]
      },
      {
        title: "추천 사항",
        content: "더 자세한 사용법은 공식 문서나 튜토리얼을 참고하세요.",
        steps: []
      }
    ];

    return {
      id: crypto.randomUUID(),
      toolName,
      taskContext,
      summary: `${toolName}을 사용한 ${taskContext} 작업의 기본 가이드입니다.`,
      sections: fallbackSections,
      sourceUrls: [],
      confidenceScore: 0.3, // Low confidence for fallback
      language,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }

  /**
   * Generate quick usage tip (lighter version of full guide)
   */
  async generateQuickTip(toolName: string, taskContext: string, language = "ko"): Promise<string> {
    try {
      const prompt = PromptTemplate.fromTemplate(`
        사용자가 "{taskContext}" 작업을 위해 "{toolName}"를 사용할 때 가장 중요한 팁 하나를 2-3문장으로 간단히 알려주세요.
        실용적이고 즉시 적용 가능한 내용으로 작성해주세요.
      `);

      const chain = RunnableSequence.from([prompt, model, new StringOutputParser()]);
      const response = await chain.invoke({ toolName, taskContext });

      return response.trim();
    } catch (error) {
      logger.error("Quick tip generation failed", {
        toolName,
        taskContext,
        error: error instanceof Error ? error.message : String(error)
      });

      return `${toolName}을 사용하여 ${taskContext} 작업을 시작해보세요. 공식 문서나 튜토리얼을 참고하시면 더 자세한 정보를 얻을 수 있습니다.`;
    }
  }
}

export const guideGenerationService = GuideGenerationService.getInstance();
export type { ToolGuide, GuideSection, GenerateGuideOptions };