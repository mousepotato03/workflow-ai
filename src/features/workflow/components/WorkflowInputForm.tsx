"use client";

import React from "react";
import { motion } from "framer-motion";
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

interface WorkflowInputFormProps {
  onButtonClick?: () => void;
}

export function WorkflowInputForm({ onButtonClick }: WorkflowInputFormProps) {
  const { toast } = useToast();
  const { setWorkflowResult, setIsLoading, setUserGoal } = useWorkflowStore();

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
    // 버튼 클릭 시 콜백 호출
    onButtonClick?.();

    // Store user goal in the store
    setUserGoal(data.goal);

    // Detect language using franc
    const detectedLang = franc(data.goal);
    const language = languageMap[detectedLang] || "en"; // Default to English

    mutation.mutate({
      goal: data.goal,
      language,
    });

    // 워크플로우 생성 시작 시 자동 스크롤
    setTimeout(() => {
      const workflowCanvas = document.querySelector("[data-workflow-canvas]");
      if (workflowCanvas) {
        workflowCanvas.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        });
      }
    }, 100); // 0.1초 후 스크롤 시작
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <motion.form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <motion.div
            whileFocus={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Textarea
              placeholder="e.g., Launch a new marketing campaign for our new product"
              className="min-h-[120px] resize-none bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary text-lg p-6 transition-all duration-300"
              {...register("goal")}
              disabled={mutation.isPending}
            />
          </motion.div>
          {errors.goal && (
            <motion.p
              className="text-red-400 text-sm"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              key={errors.goal.message}
            >
              {errors.goal.message}
            </motion.p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          whileHover={{ scale: mutation.isPending ? 1 : 1.02 }}
          whileTap={{ scale: mutation.isPending ? 1 : 0.98 }}
        >
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-4 px-8 rounded-xl text-lg transition-all duration-200 relative overflow-hidden"
          >
            <motion.span
              animate={mutation.isPending ? { opacity: 0 } : { opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center"
            >
              {mutation.isPending ? null : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Get Workflow
                </>
              )}
            </motion.span>

            {mutation.isPending && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                >
                  Analyzing...
                </motion.span>
              </motion.span>
            )}

            {/* Loading Background Animation */}
            {mutation.isPending && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-primary/50 via-primary/30 to-primary/50 -translate-x-full"
                animate={{ translateX: "200%" }}
                transition={{
                  duration: 2.0,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            )}
          </Button>
        </motion.div>
      </motion.form>
    </motion.div>
  );
}
