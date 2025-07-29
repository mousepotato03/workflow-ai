"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { franc } from "franc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";
import { WorkflowRequest, WorkflowResponse } from "@/types/workflow";
import { useWorkflowStore } from "../hooks/useWorkflowStore";

const formSchema = z.object({
  goal: z
    .string()
    .min(10, "Please enter at least 10 characters.")
    .max(200, "Please keep it under 200 characters."),
});

type FormData = z.infer<typeof formSchema>;

// Language code mapping for franc
const languageMap: Record<string, string> = {
  kor: "ko",
  eng: "en",
  jpn: "ja",
  cmn: "zh",
  spa: "es",
  fra: "fr",
  deu: "de",
  rus: "ru",
};

const createWorkflowMutation = async (
  data: WorkflowRequest
): Promise<WorkflowResponse> => {
  const response = await fetch("/api/workflow", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to create workflow.");
  }

  return response.json();
};

export function WorkflowInputForm() {
  const { toast } = useToast();
  const { setWorkflowResult, setIsLoading } = useWorkflowStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      goal: "",
    },
  });

  const goalValue = watch("goal");

  const mutation = useMutation({
    mutationFn: createWorkflowMutation,
    onMutate: () => {
      setIsLoading(true);
      setWorkflowResult(null);
    },
    onSuccess: (data) => {
      setWorkflowResult(data);
      setIsLoading(false);
      toast({
        title: "Workflow Created!",
        description: `Generated ${data.tasks.length} tasks with tool recommendations.`,
      });
    },
    onError: (error) => {
      setIsLoading(false);
      toast({
        title: "Error occurred",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    // Detect language using franc
    const detectedLang = franc(data.goal);
    const language = languageMap[detectedLang] || "en"; // Default to English

    mutation.mutate({
      goal: data.goal,
      language,
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <Textarea
            placeholder="e.g., Launch a new marketing campaign for our new product"
            className="min-h-[120px] resize-none bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 focus:border-blue-500 text-lg p-6"
            {...register("goal")}
          />
          {errors.goal && (
            <p className="text-red-400 text-sm">{errors.goal.message}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-8 rounded-xl text-lg transition-all duration-200"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            "Get Workflow"
          )}
        </Button>
      </form>
    </div>
  );
}
