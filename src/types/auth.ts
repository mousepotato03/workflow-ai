export interface User {
  id: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  plan?: "free" | "plus";
}

// Removed ToolInteraction and Review types due to schema cleanup

export interface AuthContextType {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

// API Request/Response types
export interface CreateInteractionRequest {
  interaction_type: -1 | 1 | 0; // 0 means delete
}

export interface CreateReviewRequest {
  content: string;
}

export interface UpdateReviewRequest {
  content: string;
}
