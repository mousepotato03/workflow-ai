import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  JsonOutputParser,
  StringOutputParser,
} from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { Document } from "@langchain/core/documents";
import { taskDecompositionCache, CacheUtils } from "@/lib/cache/memory-cache";
import { getEnvVar } from "@/lib/config/env-validation";

// Initialize Gemini model with validated environment
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-pro",
  temperature: 0,
  apiKey: getEnvVar("GOOGLE_API_KEY"),
});

// Task Decomposer Chain with caching
export const createTaskDecomposerChain = () => {
  const prompt = PromptTemplate.fromTemplate(`
    You are a highly-skilled project manager. Your task is to break down a user's goal into a list of 2-5 concrete, actionable sub-tasks.
    The output MUST be a JSON object with a key "tasks", which contains an array of strings.
    IMPORTANT: You MUST respond in the same language as the user's input. The user's goal is provided below in the language: {language}.
    
    User Goal: {goal}
  `);

  const outputParser = new JsonOutputParser();
  const chain = RunnableSequence.from([prompt, model, outputParser]);

  // Return wrapped chain with caching
  return {
    async invoke(input: { goal: string; language: string }) {
      const cacheKey = CacheUtils.generateKey({
        goal: input.goal.toLowerCase().trim(),
        language: input.language,
      });

      return await CacheUtils.withCache(
        taskDecompositionCache,
        cacheKey,
        async () => {
          try {
            const result = await chain.invoke(input);

            // Validate the result
            if (!result || !result.tasks || !Array.isArray(result.tasks)) {
              throw new Error("Invalid task decomposition result format");
            }

            if (result.tasks.length < 2 || result.tasks.length > 5) {
              throw new Error(
                `Invalid number of tasks: ${result.tasks.length}. Expected 2-5 tasks.`
              );
            }

            return result;
          } catch (error) {
            // Enhanced error logging
            console.error("Task decomposition failed:", {
              error: error instanceof Error ? error.message : "Unknown error",
              input,
              timestamp: new Date().toISOString(),
            });
            throw error;
          }
        }
      );
    },
  };
};

// Tool Recommender Chain
export const createToolRecommenderChain = () => {
  const prompt = PromptTemplate.fromTemplate(`
    You are an expert on AI tools. Your job is to recommend the single best tool to accomplish a given 'task', based on the provided 'context'.
    Explain WHY this tool is the best choice for the task.
    If no tool in the context is suitable, respond with "No suitable tool found."
    IMPORTANT: You MUST respond in the same language as the user's original goal. The language is: {language}.
    
    Task: {task}
    
    Available Tools Context:
    {context}
    
    Please provide your recommendation in the following format:
    Tool Name: [exact tool name from context]
    Reason: [explanation why this tool is best]
  `);

  const outputParser = new StringOutputParser();

  return RunnableSequence.from([prompt, model, outputParser]);
};

// Helper function to format tools context for the recommender
export const formatToolsContext = (tools: Document[]): string => {
  return tools
    .map((tool, index) => {
      const metadata = tool.metadata;
      return `${index + 1}. ${metadata.name}
Description: ${metadata.description}
Categories: ${metadata.categories.join(", ")}
Pros: ${metadata.pros.join(", ")}
Cons: ${metadata.cons.join(", ")}
Recommendation Tip: ${metadata.recommendation_tip}
---`;
    })
    .join("\n");
};

// Helper function to parse tool recommendation response
export const parseToolRecommendation = (
  response: string | any
): {
  toolName: string | null;
  reason: string;
} => {
  // Handle different response types from LangChain
  let responseText: string;

  if (typeof response === "string") {
    responseText = response;
  } else if (response && typeof response === "object") {
    // Handle AIMessage or similar objects
    responseText = response.content || response.text || String(response);
  } else {
    responseText = String(response);
  }

  const lines = responseText.split("\n");
  let toolName: string | null = null;
  let reason = "";

  for (const line of lines) {
    if (line.startsWith("Tool Name:")) {
      toolName = line.replace("Tool Name:", "").trim();
    } else if (line.startsWith("Reason:")) {
      reason = line.replace("Reason:", "").trim();
    }
  }

  // If no structured response, treat entire response as reason
  if (!toolName && !reason) {
    reason = responseText.trim();
  }

  return { toolName, reason };
};
