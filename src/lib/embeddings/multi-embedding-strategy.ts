import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

// Multi-embedding strategy for enhanced semantic search
export class MultiEmbeddingStrategy {
  private primaryEmbedding: GoogleGenerativeAIEmbeddings;
  private secondaryEmbedding?: OpenAIEmbeddings;
  private enableHybridSearch: boolean;

  constructor(options: {
    googleApiKey: string;
    openaiApiKey?: string;
    enableHybridSearch?: boolean;
  }) {
    this.primaryEmbedding = new GoogleGenerativeAIEmbeddings({
      model: "text-embedding-004", // Latest Gemini embedding model (768 dimensions)
      apiKey: options.googleApiKey,
    });

    if (options.openaiApiKey) {
      this.secondaryEmbedding = new OpenAIEmbeddings({
        model: "text-embedding-3-large", // High-dimensional embeddings
        apiKey: options.openaiApiKey,
        dimensions: 768, // Match pgvector dimension
      });
    }

    this.enableHybridSearch = options.enableHybridSearch || false;
  }

  // Optimized text preprocessing for embeddings
  private preprocessText(
    text: string,
    contentType: "tool" | "workflow" | "knowledge"
  ): string {
    // Remove excessive whitespace and normalize
    let processed = text.trim().replace(/\s+/g, " ");

    // Content-specific preprocessing
    switch (contentType) {
      case "tool":
        // Emphasize functionality and use cases
        processed = this.enhanceToolDescription(processed);
        break;
      case "workflow":
        // Focus on process steps and outcomes
        processed = this.enhanceWorkflowDescription(processed);
        break;
      case "knowledge":
        // Preserve technical details and context
        processed = this.enhanceKnowledgeContent(processed);
        break;
    }

    return processed;
  }

  private enhanceToolDescription(text: string): string {
    // Add contextual markers for better embedding quality
    const enhanced = `Tool Description: ${text}`;
    return enhanced;
  }

  private enhanceWorkflowDescription(text: string): string {
    const enhanced = `Workflow Process: ${text}`;
    return enhanced;
  }

  private enhanceKnowledgeContent(text: string): string {
    const enhanced = `Knowledge Content: ${text}`;
    return enhanced;
  }

  // Generate embeddings with fallback strategy
  async generateEmbedding(
    text: string,
    contentType: "tool" | "workflow" | "knowledge" = "tool"
  ): Promise<number[]> {
    const processedText = this.preprocessText(text, contentType);

    try {
      // Primary embedding (Gemini)
      const embedding = await this.primaryEmbedding.embedQuery(processedText);
      return embedding;
    } catch (error) {
      console.warn("Primary embedding failed, trying fallback:", error);

      if (this.secondaryEmbedding) {
        try {
          return await this.secondaryEmbedding.embedQuery(processedText);
        } catch (fallbackError) {
          console.error("All embedding strategies failed:", fallbackError);
          throw new Error("Embedding generation failed");
        }
      }

      throw error;
    }
  }

  // Batch embedding generation for efficiency
  async generateBatchEmbeddings(
    texts: Array<{ text: string; type: "tool" | "workflow" | "knowledge" }>,
    batchSize: number = 10
  ): Promise<number[][]> {
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map((item) =>
        this.generateEmbedding(item.text, item.type)
      );

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error(`Batch ${i}-${i + batchSize} failed:`, error);
        // Handle partial failures
        for (const item of batch) {
          try {
            const embedding = await this.generateEmbedding(
              item.text,
              item.type
            );
            results.push(embedding);
          } catch (itemError) {
            console.error(`Failed to embed: ${item.text.substring(0, 50)}...`);
            // Push zero vector as placeholder
            results.push(new Array(768).fill(0));
          }
        }
      }

      // Rate limiting pause
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }

  // Hybrid search combining vector and keyword search
  async hybridSearch(
    query: string,
    vectorResults: Document[],
    keywordResults: Document[],
    vectorWeight: number = 0.7
  ): Promise<Document[]> {
    if (!this.enableHybridSearch) {
      return vectorResults;
    }

    // Combine and rerank results
    const combinedResults = new Map<
      string,
      { doc: Document; vectorScore: number; keywordScore: number }
    >();

    // Process vector results
    vectorResults.forEach((doc, index) => {
      const score = Math.max(0, 1 - index / vectorResults.length);
      combinedResults.set(doc.metadata.id, {
        doc,
        vectorScore: score,
        keywordScore: 0,
      });
    });

    // Process keyword results
    keywordResults.forEach((doc, index) => {
      const score = Math.max(0, 1 - index / keywordResults.length);
      const existing = combinedResults.get(doc.metadata.id);

      if (existing) {
        existing.keywordScore = score;
      } else {
        combinedResults.set(doc.metadata.id, {
          doc,
          vectorScore: 0,
          keywordScore: score,
        });
      }
    });

    // Calculate hybrid scores and sort
    const hybridResults = Array.from(combinedResults.values())
      .map((item) => ({
        ...item,
        hybridScore:
          item.vectorScore * vectorWeight +
          item.keywordScore * (1 - vectorWeight),
      }))
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .map((item) => item.doc);

    return hybridResults;
  }
}

// Specialized embedding strategies for different content types
export class ToolEmbeddingStrategy {
  private embedder: MultiEmbeddingStrategy;

  constructor(embedder: MultiEmbeddingStrategy) {
    this.embedder = embedder;
  }

  async embedToolData(tool: {
    name: string;
    description: string;
    categories: string[];
    use_cases: string[];
    pros: string[];
    cons: string[];
  }): Promise<{ embeddingText: string; embedding: number[] }> {
    // Create comprehensive embedding text
    const embeddingText = this.createToolEmbeddingText(tool);
    const embedding = await this.embedder.generateEmbedding(
      embeddingText,
      "tool"
    );

    return { embeddingText, embedding };
  }

  private createToolEmbeddingText(tool: {
    name: string;
    description: string;
    categories: string[];
    use_cases: string[];
    pros: string[];
    cons: string[];
  }): string {
    const parts = [
      `Tool: ${tool.name}`,
      `Description: ${tool.description}`,
      `Categories: ${tool.categories.join(", ")}`,
      `Use Cases: ${tool.use_cases.join(", ")}`,
      `Strengths: ${tool.pros.join(", ")}`,
      `Limitations: ${tool.cons.join(", ")}`,
    ];

    return parts
      .filter((part) => part.includes(": ") && !part.endsWith(": "))
      .join(". ");
  }
}

export class WorkflowEmbeddingStrategy {
  private embedder: MultiEmbeddingStrategy;

  constructor(embedder: MultiEmbeddingStrategy) {
    this.embedder = embedder;
  }

  async embedWorkflowPattern(pattern: {
    pattern_name: string;
    pattern_type: string;
    industry: string[];
    common_subtasks: string[];
    required_skills: string[];
    input_types: string[];
    output_types: string[];
  }): Promise<{ embeddingText: string; embedding: number[] }> {
    const embeddingText = this.createWorkflowEmbeddingText(pattern);
    const embedding = await this.embedder.generateEmbedding(
      embeddingText,
      "workflow"
    );

    return { embeddingText, embedding };
  }

  private createWorkflowEmbeddingText(pattern: {
    pattern_name: string;
    pattern_type: string;
    industry: string[];
    common_subtasks: string[];
    required_skills: string[];
    input_types: string[];
    output_types: string[];
  }): string {
    const parts = [
      `Workflow: ${pattern.pattern_name}`,
      `Type: ${pattern.pattern_type}`,
      `Industries: ${pattern.industry.join(", ")}`,
      `Tasks: ${pattern.common_subtasks.join(", ")}`,
      `Skills Required: ${pattern.required_skills.join(", ")}`,
      `Input Types: ${pattern.input_types.join(", ")}`,
      `Output Types: ${pattern.output_types.join(", ")}`,
    ];

    return parts
      .filter((part) => part.includes(": ") && !part.endsWith(": "))
      .join(". ");
  }
}

// Factory function to create embedding strategies
export function createEmbeddingStrategies(config: {
  googleApiKey: string;
  openaiApiKey?: string;
  enableHybridSearch?: boolean;
}) {
  const multiEmbedder = new MultiEmbeddingStrategy(config);

  return {
    multiEmbedder,
    toolEmbedder: new ToolEmbeddingStrategy(multiEmbedder),
    workflowEmbedder: new WorkflowEmbeddingStrategy(multiEmbedder),
  };
}
