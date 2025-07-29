export interface WorkflowRequest {
  goal: string;
  language: string;
}

export interface WorkflowResponse {
  workflowId: string;
  tasks: {
    id: string;
    name: string;
    order: number;
    recommendedTool: {
      id: string;
      name: string;
      logoUrl: string;
      url: string;
    } | null;
    recommendationReason: string;
    confidence: number;
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
  pros: string[];
  cons: string[];
  embeddingText: string;
  recommendationTip: string;
}
