export interface WorkflowRequest {
  goal: string;
  language: string;
}

// Subtask interface for workflow creation (without tool recommendations)
export interface Subtask {
  id: string;
  name: string;
  order: number;
  recommendedTool: null; // Always null at creation
  recommendationReason: string;
  confidence: number; // Confidence in task decomposition
}

export interface WorkflowResponse {
  workflowId: string;
  tasks: {
    id: string;
    name: string;
    order: number;
    // Tool recommendation is initially null and populated during guide generation
    recommendedTool: {
      id: string;
      name: string;
      logoUrl: string;
      url: string;
    } | null;
    recommendationReason: string;
    usageGuidance?: string; // User-focused guidance text
    confidence: number; // Confidence in the task decomposition (not tool recommendation)
    guideGenerationStatus?: "pending" | "generating" | "success" | "failed";
    guideGenerationError?: string; // Error message for failed guide generation
  }[];
  status: "completed" | "processing" | "failed";
}

export interface FeedbackRequest {
  workflowId: string;
  rating: number;
  comment?: string;
}

export interface FeedbackResponse {
  success: boolean;
  message: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  url: string;
  logoUrl: string;
  categories: string[];
  embeddingText: string;
}
