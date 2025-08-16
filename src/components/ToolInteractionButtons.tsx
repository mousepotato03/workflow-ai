"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { LoginRequiredModal } from "@/components/LoginRequiredModal";
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
  // Feature removed per schema cleanup
  return null;
}
