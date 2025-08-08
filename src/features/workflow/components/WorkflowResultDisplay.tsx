"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ExternalLink,
  Star,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Target,
  RefreshCw,
} from "lucide-react";
import { useWorkflowStore } from "../hooks/useWorkflowStore";
// import { FeedbackRequest, FeedbackResponse } from "@/types/workflow";
import { TaskCard } from "./TaskCard";
// Feedback removed per schema cleanup

// Feedback API removed

export function WorkflowResultDisplay() {
  const { workflowResult, isLoading, clearWorkflow } = useWorkflowStore();
  const { toast } = useToast();
  // const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // const feedbackMutation = useMutation({
  //   mutationFn: submitFeedbackMutation,
  //   onSuccess: (data) => {
  //     setFeedbackSubmitted(true);
  //     toast({
  //       title: "Feedback Submitted",
  //       description: data.message,
  //     });
  //   },
  //   onError: (error) => {
  //     toast({
  //       title: "Failed to Submit Feedback",
  //       description: error.message,
  //       variant: "destructive",
  //     });
  //   },
  // });

  // const handleFeedbackSubmit = (rating: number, comment?: string) => {
  //   if (!workflowResult) return;
  //   feedbackMutation.mutate({
  //     workflowId: workflowResult.workflowId,
  //     rating,
  //     comment,
  //   });
  // };

  const handleStartOver = () => {
    clearWorkflow();
    // setFeedbackSubmitted(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="mt-8">
        <Card className="border border-border bg-card">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="flex items-center space-x-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">
                    AI is analyzing your workflow
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Please wait a moment...
                  </p>
                </div>
              </div>
              <div className="w-full max-w-md">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No result state
  if (!workflowResult) {
    return null;
  }

  // Success state
  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/30 dark:to-blue-950/30 rounded-lg p-6 border border-green-200 dark:border-green-800">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground">
              Your Workflow is Ready!
            </h3>
            <p className="text-muted-foreground mt-1">
              Follow {workflowResult.tasks.length} personalized steps with
              recommended tools and guidance
            </p>
          </div>
        </div>
        <Button
          onClick={handleStartOver}
          variant="outline"
          size="default"
          className="flex items-center space-x-2 border-border text-muted-foreground hover:bg-muted"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Start New Workflow</span>
        </Button>
      </div>

      {/* Tasks */}
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Target className="w-6 h-6 text-primary" />
          <div>
            <h4 className="text-xl font-semibold text-foreground">
              Your Step-by-Step Guide
            </h4>
            <p className="text-sm text-muted-foreground mt-1">
              Each step includes specific tools and actionable guidance tailored
              to your goal
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          {workflowResult.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </div>

      <Separator className="my-6 bg-border" />

      {/* Feedback Section removed */}

      {/* Workflow Summary */}
      <Card className="bg-card border border-border">
        <CardContent className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h4 className="font-semibold text-foreground">Workflow Summary</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="text-2xl font-bold text-primary">
                {workflowResult.tasks.length}
              </div>
              <div className="text-sm text-muted-foreground">Task Steps</div>
              <div className="text-xs text-muted-foreground/70">
                Structured approach to reach your goal
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-accent">
                {workflowResult.tasks.filter((t) => t.recommendedTool).length}
              </div>
              <div className="text-sm text-muted-foreground">
                Recommended Tools
              </div>
              <div className="text-xs text-muted-foreground/70">
                Curated tools to help you succeed
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-green-400">
                {workflowResult.status === "completed" ? "Ready" : "Processing"}
              </div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="text-xs text-muted-foreground/70">
                Your personalized workflow is ready to use
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
