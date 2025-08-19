"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
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
  FileText,
  Download,
  Search,
} from "lucide-react";
import { WorkflowResponse } from "@/types/workflow";
import { GuideModal } from "@/components/GuideModal";

interface TaskCardProps {
  task: WorkflowResponse["tasks"][0];
  hasDetailedGuide?: boolean;
  onDownloadGuide?: () => void;
  onSearchTools?: (taskId: string) => void;
}

export function TaskCard({
  task,
  hasDetailedGuide = false,
  onDownloadGuide,
  onSearchTools,
}: TaskCardProps) {
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  const handleToolClick = () => {
    if (task.recommendedTool?.url) {
      window.open(task.recommendedTool.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleGuideClick = () => {
    setIsGuideModalOpen(true);
  };

  const handleSearchTools = () => {
    if (onSearchTools) {
      onSearchTools(task.id);
    }
  };

  const getRecommendationStatus = (hasRecommendation: boolean, hasToolRecommendation?: boolean) => {
    if (hasRecommendation) {
      return {
        text: "Tool Recommended",
        className: "text-green-400 bg-green-900/30 border-green-700",
      };
    }
    
    if (hasToolRecommendation === false) {
      return {
        text: "Ready for Tool Search",
        className: "text-yellow-400 bg-yellow-900/30 border-yellow-700",
      };
    }
    
    return {
      text: "Manual Approach",
      className: "text-blue-400 bg-blue-900/30 border-blue-700",
    };
  };

  const generateUsageGuidance = (task: any) => {
    // Use dedicated usage guidance if available
    if (task.usageGuidance) {
      return task.usageGuidance;
    }

    // Handle tasks without tool recommendations
    if (!task.recommendedTool) {
      // Check if this is a newly created task without tool search
      if (task.hasToolRecommendation === false) {
        return "이 작업에 적합한 도구를 찾기 위해 가이드 생성을 시작하세요. 시스템이 관련 도구를 검색하고 추천해드립니다.";
      }
      
      // Default manual approach message
      return (
        task.recommendationReason ||
        "이 작업은 수동 접근이 권장됩니다. 전문가와 상담하거나 관련 도구를 직접 검색해보세요."
      );
    }

    // Transform technical reason into user-focused guidance
    const reason = task.recommendationReason || "";
    const toolName = task.recommendedTool.name;
    const taskName = task.name.toLowerCase();

    // Generate actionable guidance based on the task and tool
    let guidance = `${toolName}을(를) 사용하여 ${taskName}을(를) 수행하세요:`;

    // Try to extract actionable steps from the recommendation reason
    const cleanedReason = reason
      .replace(/because|since|due to|as it|this tool|the tool/gi, "")
      .replace(/is ideal|is perfect|is good|works well/gi, "도움이 됩니다")
      .replace(/Score.*?\)/gi, "")
      .trim();

    if (cleanedReason && cleanedReason.length > 10) {
      guidance += ` ${
        cleanedReason.charAt(0).toUpperCase() + cleanedReason.slice(1)
      }.`;
    } else {
      guidance += ` 이 도구는 해당 작업에 적합한 기능을 제공합니다.`;
    }

    return guidance;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      whileHover={{
        scale: 1.02,
        boxShadow:
          "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
      }}
    >
      <Card className="border border-border bg-card hover:border-muted-foreground transition-colors duration-200">
        <CardContent className="p-6">
          <motion.div
            className="flex items-start justify-between mb-6"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="flex items-center space-x-3">
              <motion.div
                className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-sm font-semibold text-primary-foreground"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  duration: 0.4,
                  delay: 0.2,
                  type: "spring",
                  stiffness: 200,
                }}
              >
                {task.order}
              </motion.div>
              <div>
                <motion.h3
                  className="font-semibold text-foreground text-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  {task.name}
                </motion.h3>
                <motion.p
                  className="text-sm text-muted-foreground mt-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                >
                  Step {task.order} of your workflow
                </motion.p>
              </div>
            </div>
            <motion.div
              className="flex items-center space-x-2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <Badge
                variant="secondary"
                className={`${
                  getRecommendationStatus(!!task.recommendedTool, (task as any).hasToolRecommendation).className
                } border`}
              >
                {getRecommendationStatus(!!task.recommendedTool, (task as any).hasToolRecommendation).text}
              </Badge>

              {hasDetailedGuide && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.5, type: "spring" }}
                >
                  <Badge
                    variant="secondary"
                    className="text-purple-400 bg-purple-900/30 border-purple-700"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    Detailed Guide Available
                  </Badge>
                </motion.div>
              )}
            </motion.div>
          </motion.div>

          {task.recommendedTool ? (
            <motion.div
              className="bg-muted rounded-lg p-5 space-y-4 border border-border"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            >
              {/* Tool Header */}
              <motion.div
                className="flex items-center justify-between"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
              >
                <div className="flex items-center space-x-3">
                  {task.recommendedTool.logoUrl ? (
                    <motion.img
                      src={task.recommendedTool.logoUrl}
                      alt={`${task.recommendedTool.name} logo`}
                      className="w-12 h-12 rounded-lg object-cover border border-border"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.5, type: "spring" }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        target.nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  ) : null}
                  <motion.div
                    className={`w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center ${
                      task.recommendedTool.logoUrl ? "hidden" : ""
                    }`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.5, type: "spring" }}
                  >
                    <ImageIcon className="w-6 h-6 text-white" />
                  </motion.div>
                  <div>
                    <motion.h4
                      className="font-semibold text-foreground text-lg"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.6 }}
                    >
                      {task.recommendedTool.name}
                    </motion.h4>
                    <motion.p
                      className="text-sm text-muted-foreground"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.7 }}
                    >
                      Recommended for this step
                    </motion.p>
                  </div>
                </div>

                <motion.div
                  className="flex gap-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                >
                  {hasDetailedGuide && onDownloadGuide && (
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        onClick={onDownloadGuide}
                        variant="outline"
                        size="lg"
                        className="px-4 border-purple-500/50 bg-purple-900/20 text-purple-400 hover:bg-purple-900/30"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Guide
                      </Button>
                    </motion.div>
                  )}
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      onClick={handleGuideClick}
                      variant="outline"
                      size="lg"
                      className="px-4"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Quick Guide
                    </Button>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      onClick={handleToolClick}
                      size="lg"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Start Using
                    </Button>
                  </motion.div>
                </motion.div>
              </motion.div>

              {/* Usage Guidance */}
              <motion.div
                className="bg-card rounded-md p-4 border border-border"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <div className="flex items-start space-x-3">
                  <motion.div
                    className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.7, type: "spring" }}
                  >
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </motion.div>
                  <div className="flex-1">
                    <motion.h5
                      className="font-medium text-foreground mb-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.8 }}
                    >
                      How to use this tool:
                    </motion.h5>
                    <motion.p
                      className="text-sm text-muted-foreground leading-relaxed"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.9 }}
                    >
                      {generateUsageGuidance(task)}
                    </motion.p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              className={`${
                (task as any).hasToolRecommendation === false 
                  ? "bg-yellow-900/30 border border-yellow-700" 
                  : "bg-blue-900/30 border border-blue-700"
              } rounded-lg p-5 space-y-3`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            >
              <motion.div
                className="flex items-start justify-between"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
              >
                <div className="flex items-start space-x-3 flex-1">
                  <motion.div
                    className={`w-6 h-6 ${
                      (task as any).hasToolRecommendation === false 
                        ? "bg-yellow-600" 
                        : "bg-blue-600"
                    } rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.5, type: "spring" }}
                  >
                    <AlertCircle className="w-4 h-4 text-white" />
                  </motion.div>
                  <div className="flex-1">
                    <motion.h5
                      className={`font-medium ${
                        (task as any).hasToolRecommendation === false 
                          ? "text-yellow-200" 
                          : "text-blue-200"
                      } mb-2`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.6 }}
                    >
                      {(task as any).hasToolRecommendation === false 
                        ? "도구 검색 가능" 
                        : "수동 접근 권장"}
                    </motion.h5>
                    <motion.p
                      className={`text-sm ${
                        (task as any).hasToolRecommendation === false 
                          ? "text-yellow-300" 
                          : "text-blue-300"
                      } leading-relaxed`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.7 }}
                    >
                      {generateUsageGuidance(task)}
                    </motion.p>
                  </div>
                </div>
                
                {(task as any).hasToolRecommendation === false && onSearchTools && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.6 }}
                  >
                    <Button
                      onClick={handleSearchTools}
                      variant="outline"
                      size="sm"
                      className="ml-4 border-yellow-500/50 bg-yellow-900/20 text-yellow-400 hover:bg-yellow-900/30"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      도구 검색
                    </Button>
                  </motion.div>
                )}
              </motion.div>
              
              {(task as any).hasToolRecommendation !== false && (
                <motion.div
                  className="bg-blue-800/30 rounded-md p-3 border border-blue-600"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.6 }}
                >
                  <motion.p
                    className="text-xs text-blue-200"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.8 }}
                  >
                    <strong>Tip:</strong> 전문 도구를 직접 검색하거나 전문가와 상담하세요.
                  </motion.p>
                </motion.div>
              )}
            </motion.div>
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
    </motion.div>
  );
}
