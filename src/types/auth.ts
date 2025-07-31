export interface User {
  id: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ToolInteraction {
  id: number;
  user_id: string;
  tool_id: string;
  interaction_type: -1 | 1; // -1: dislike, 1: like
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: number;
  user_id: string;
  tool_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: User; // Optional user profile for displaying reviews
}

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
