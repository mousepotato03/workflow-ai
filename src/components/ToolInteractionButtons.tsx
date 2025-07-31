"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import LoginRequiredModal from "@/components/LoginRequiredModal";
import { CreateInteractionRequest } from "@/types/auth";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface ToolInteractionButtonsProps {
  toolId: string;
  className?: string;
}

export default function ToolInteractionButtons({
  toolId,
  className = "",
}: ToolInteractionButtonsProps) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentInteraction, setCurrentInteraction] = useState<-1 | 1 | null>(
    null
  );

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Fetch user's current interaction
  const { data: interactions } = useQuery({
    queryKey: ["tool-interactions", toolId, user?.id],
    queryFn: async () => {
      if (!user) return [];

      const response = await fetch(
        `/api/tools/${toolId}/interactions?user_id=${user.id}`
      );
      if (!response.ok) return [];

      const data = await response.json();
      return data.interactions || [];
    },
    enabled: !!user && !!toolId,
  });

  useEffect(() => {
    if (interactions && interactions.length > 0) {
      setCurrentInteraction(interactions[0].interaction_type);
    } else {
      setCurrentInteraction(null);
    }
  }, [interactions]);

  // Mutation for creating/updating interaction
  const interactionMutation = useMutation({
    mutationFn: async (interactionType: -1 | 1 | 0) => {
      const body: CreateInteractionRequest = {
        interaction_type: interactionType,
      };

      const response = await fetch(`/api/tools/${toolId}/interact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "상호작용 저장에 실패했습니다.");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({
        queryKey: ["tool-interactions", toolId, user?.id],
      });
    },
    onError: (error) => {
      // Handle interaction save error silently
    },
  });

  const handleInteraction = (interactionType: -1 | 1) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    // If same interaction, remove it (toggle off)
    if (currentInteraction === interactionType) {
      interactionMutation.mutate(0); // 0 means delete
      setCurrentInteraction(null);
    } else {
      interactionMutation.mutate(interactionType);
      setCurrentInteraction(interactionType);
    }
  };

  const handleLike = () => handleInteraction(1);
  const handleDislike = () => handleInteraction(-1);

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        <Button
          variant={currentInteraction === 1 ? "default" : "outline"}
          size="sm"
          onClick={handleLike}
          disabled={interactionMutation.isPending}
          className="gap-2"
        >
          <ThumbsUp className="h-4 w-4" />
          좋아요
        </Button>
        <Button
          variant={currentInteraction === -1 ? "destructive" : "outline"}
          size="sm"
          onClick={handleDislike}
          disabled={interactionMutation.isPending}
          className="gap-2"
        >
          <ThumbsDown className="h-4 w-4" />
          싫어요
        </Button>
      </div>

      <LoginRequiredModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        message="도구에 대한 의견을 남기려면 로그인이 필요합니다."
      />
    </>
  );
}
