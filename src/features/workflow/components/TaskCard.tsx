"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { WorkflowResponse } from "@/types/workflow";
import { GuideModal } from "@/components/GuideModal";

interface TaskCardProps {
  task: WorkflowResponse["tasks"][0];
}

export function TaskCard({ task }: TaskCardProps) {
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  const handleToolClick = () => {
    if (task.recommendedTool?.url) {
      window.open(task.recommendedTool.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleGuideClick = () => {
    setIsGuideModalOpen(true);
  };

  const getRecommendationStatus = (hasRecommendation: boolean) => {
    if (hasRecommendation) {
      return {
        text: "Tool Recommended",
        className: "text-green-400 bg-green-900/30 border-green-700"
      };
    }
    return {
      text: "Manual Approach",
      className: "text-blue-400 bg-blue-900/30 border-blue-700"
    };
  };

  const generateUsageGuidance = (task: any) => {
    // Use dedicated usage guidance if available
    if (task.usageGuidance) {
      return task.usageGuidance;
    }
    
    if (!task.recommendedTool) {
      return task.recommendationReason || "Consider manual approaches, research specialized tools, or consult with experts for this step.";
    }
    
    // Transform technical reason into user-focused guidance
    const reason = task.recommendationReason || "";
    const toolName = task.recommendedTool.name;
    const taskName = task.name.toLowerCase();
    
    // Generate actionable guidance based on the task and tool
    let guidance = `Open ${toolName} and follow these steps to ${taskName}:`;
    
    // Try to extract actionable steps from the recommendation reason
    const cleanedReason = reason
      .replace(/because|since|due to|as it|this tool|the tool/gi, "")
      .replace(/is ideal|is perfect|is good|works well/gi, "helps you")
      .trim();
    
    if (cleanedReason) {
      guidance += ` ${cleanedReason.charAt(0).toUpperCase() + cleanedReason.slice(1)}.`;
    }
    
    return guidance;
  };

  return (
    <Card className="border border-border bg-card hover:border-muted-foreground transition-colors duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-sm font-semibold text-primary-foreground">
              {task.order}
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg">{task.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Step {task.order} of your workflow
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={`${getRecommendationStatus(!!task.recommendedTool).className} border`}
          >
            {getRecommendationStatus(!!task.recommendedTool).text}
          </Badge>
        </div>

        {task.recommendedTool ? (
          <div className="bg-muted rounded-lg p-5 space-y-4 border border-border">
            {/* Tool Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {task.recommendedTool.logoUrl ? (
                  <img
                    src={task.recommendedTool.logoUrl}
                    alt={`${task.recommendedTool.name} logo`}
                    className="w-12 h-12 rounded-lg object-cover border border-border"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      target.nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <div
                  className={`w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center ${
                    task.recommendedTool.logoUrl ? "hidden" : ""
                  }`}
                >
                  <ImageIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground text-lg">
                    {task.recommendedTool.name}
                  </h4>
                  <p className="text-sm text-muted-foreground">Recommended for this step</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleGuideClick}
                  variant="outline"
                  size="lg"
                  className="px-4"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  상세 가이드
                </Button>
                <Button
                  onClick={handleToolClick}
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Start Using
                </Button>
              </div>
            </div>

            {/* Usage Guidance */}
            <div className="bg-card rounded-md p-4 border border-border">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <h5 className="font-medium text-foreground mb-2">How to use this tool:</h5>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {generateUsageGuidance(task)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-5 space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h5 className="font-medium text-blue-200 mb-2">
                  Manual approach recommended
                </h5>
                <p className="text-sm text-blue-300 leading-relaxed">
                  {generateUsageGuidance(task)}
                </p>
              </div>
            </div>
            <div className="bg-blue-800/30 rounded-md p-3 border border-blue-600">
              <p className="text-xs text-blue-200">
                <strong>Tip:</strong> Consider researching specialized tools or consulting with experts for this step.
              </p>
            </div>
          </div>
        )}

        {/* Guide Modal */}
        {task.recommendedTool && (
          <GuideModal
            isOpen={isGuideModalOpen}
            onClose={() => setIsGuideModalOpen(false)}
            toolId={task.recommendedTool.id}
            toolName={task.recommendedTool.name}
            toolUrl={task.recommendedTool.url}
            toolLogoUrl={task.recommendedTool.logoUrl}
            taskContext={task.name}
          />
        )}
      </CardContent>
    </Card>
  );
}
