"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Star,
  ExternalLink,
  Download,
  Clock,
  Sparkles,
} from "lucide-react";
import { WorkflowResponse } from "@/types/workflow";

interface Task {
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
  usageGuidance?: string;
  confidence: number;
}

interface GuideGenerationSectionProps {
  tasks: WorkflowResponse["tasks"];
  onGuideGenerated: (taskId: string, guide: string) => void;
  onGuideGenerationFailed?: (taskId: string, error: string) => void;
}

interface GuideGenerationStatus {
  taskId: string;
  status: "pending" | "generating" | "completed" | "error";
  progress: number;
  guide?: string;
  error?: string;
}

export function GuideGenerationSection({
  tasks,
  onGuideGenerated,
  onGuideGenerationFailed,
}: GuideGenerationSectionProps) {
  const { toast } = useToast();
  const [generationStatuses, setGenerationStatuses] = useState<
    Record<string, GuideGenerationStatus>
  >({});
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  const updateTaskStatus = (
    taskId: string,
    updates: Partial<GuideGenerationStatus>
  ) => {
    setGenerationStatuses((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], taskId, ...updates },
    }));
  };

  const generateGuideForTask = async (task: Task) => {
    console.log("=== 가이드 생성 시작 ===", {
      taskId: task.id,
      taskName: task.name,
      recommendedTool: task.recommendedTool?.name,
      recommendedToolId: task.recommendedTool?.id,
      hasRecommendedTool: !!task.recommendedTool,
      timestamp: new Date().toISOString()
    });

    // 추가 디버깅: 전체 task 객체 출력
    console.log("전체 task 객체:", JSON.stringify(task, null, 2));

    if (!task.recommendedTool) {
      console.error("❌ 가이드 생성 실패: 추천된 도구 없음", { 
        taskId: task.id, 
        taskName: task.name,
        task: task 
      });
      
      // 더 눈에 띄는 에러 메시지
      alert(`가이드 생성 실패: ${task.name} - 추천된 도구가 없습니다.`);
      
      updateTaskStatus(task.id, {
        status: "error",
        error: "이 작업에는 추천된 도구가 없습니다.",
      });
      return;
    }

    updateTaskStatus(task.id, {
      status: "generating",
      progress: 0,
    });

    console.log("가이드 생성 상태 업데이트: 생성 시작", { taskId: task.id });

    try {
      console.log("캐시된 가이드 확인 시도", {
        taskId: task.id,
        toolId: task.recommendedTool.id,
        endpoint: `/api/tools/${task.recommendedTool.id}/guide?taskContext=${encodeURIComponent(task.name)}&language=ko`
      });

      // First check if cached guide exists
      const cachedResponse = await fetch(
        `/api/tools/${task.recommendedTool.id}/guide?taskContext=${encodeURIComponent(
          task.name
        )}&language=ko`
      );

      if (cachedResponse.ok) {
        console.log("캐시된 가이드 발견, 사용", { taskId: task.id });
        const cachedGuide = await cachedResponse.json();
        const markdownGuide = convertStructuredGuideToMarkdown(
          cachedGuide,
          task
        );
        
        updateTaskStatus(task.id, {
          status: "completed",
          progress: 100,
          guide: markdownGuide,
        });
        
        onGuideGenerated(task.id, markdownGuide);
        
        console.log("가이드 생성 완료 (캐시 사용)", {
          taskId: task.id,
          guideLength: markdownGuide.length,
          timestamp: new Date().toISOString()
        });
        return;
      }

      console.log("캐시된 가이드 없음, 새로 생성", { taskId: task.id });

      // Generate new guide if no cache
      const response = await fetch(`/api/tools/${task.recommendedTool.id}/guide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskContext: task.name,
          language: "ko",
        }),
      });

      if (!response.ok) {
        console.error("가이드 생성 API 요청 실패", {
          taskId: task.id,
          status: response.status,
          statusText: response.statusText
        });
        throw new Error("가이드 생성 요청에 실패했습니다.");
      }

      console.log("가이드 생성 API 응답 수신", { taskId: task.id });

      updateTaskStatus(task.id, {
        status: "generating",
        progress: 50,
      });

      const guideData = await response.json();
      console.log("가이드 데이터 파싱 완료", {
        taskId: task.id,
        hasGuideData: !!guideData.guide,
        dataKeys: Object.keys(guideData)
      });

      const markdownGuide = convertStructuredGuideToMarkdown(guideData, task);

      updateTaskStatus(task.id, {
        status: "completed",
        progress: 100,
        guide: markdownGuide,
      });

      onGuideGenerated(task.id, markdownGuide);

      console.log("가이드 생성 완료 (새로 생성)", {
        taskId: task.id,
        guideLength: markdownGuide.length,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "가이드 생성 완료",
        description: `${task.name}에 대한 상세 가이드가 생성되었습니다.`,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      
      console.error("가이드 생성 실패", {
        taskId: task.id,
        taskName: task.name,
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
      
      updateTaskStatus(task.id, {
        status: "error",
        error: errorMessage,
      });

      // Notify parent component about the failure
      if (onGuideGenerationFailed) {
        onGuideGenerationFailed(task.id, errorMessage);
      }

      toast({
        title: "가이드 생성 실패",
        description: `${task.name}에 대한 가이드 생성 중 오류가 발생했습니다.`,
        variant: "destructive",
      });
    }
  };

  const generateAllGuides = async () => {
    setIsGeneratingAll(true);
    
    console.log("=== 전체 가이드 생성 시작 ===", {
      totalTasks: tasks.length,
      taskNames: tasks.map(t => t.name),
      timestamp: new Date().toISOString()
    });

    // 각 태스크의 상태를 자세히 출력
    console.log("각 태스크 상태 확인:");
    tasks.forEach((task, index) => {
      console.log(`Task ${index + 1}:`, {
        id: task.id,
        name: task.name,
        hasRecommendedTool: !!task.recommendedTool,
        recommendedToolName: task.recommendedTool?.name,
        recommendedToolId: task.recommendedTool?.id,
        confidence: task.confidence
      });
    });
    
    try {
      // Initialize all tasks as pending
      console.log("모든 태스크 상태 초기화 시작");
      for (const task of tasks) {
        updateTaskStatus(task.id, {
          status: "pending",
          progress: 0,
        });
        console.log("태스크 상태 초기화", { taskId: task.id, taskName: task.name, status: "pending" });
      }

      // Generate guides sequentially for each task
      console.log("순차적 가이드 생성 시작", { totalTasks: tasks.length });
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        console.log("태스크 가이드 생성 시작", {
          taskIndex: i + 1,
          totalTasks: tasks.length,
          taskId: task.id,
          taskName: task.name
        });

        await generateGuideForTask(task);
        
        console.log("태스크 가이드 생성 완료", {
          taskIndex: i + 1,
          totalTasks: tasks.length,
          taskId: task.id,
          remainingTasks: tasks.length - (i + 1)
        });
        
        // Add delay between requests to avoid rate limiting
        if (task.id !== tasks[tasks.length - 1].id) {
          console.log("다음 태스크 처리 전 지연", { delayMs: 1000 });
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log("전체 가이드 생성 완료", {
        totalTasks: tasks.length,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "모든 가이드 생성 완료",
        description: "모든 작업에 대한 상세 가이드가 생성되었습니다.",
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
      
      console.error("전체 가이드 생성 실패", {
        error: errorMessage,
        totalTasks: tasks.length,
        timestamp: new Date().toISOString()
      });

      toast({
        title: "가이드 생성 실패",
        description: "일부 가이드 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAll(false);
      console.log("전체 가이드 생성 프로세스 종료", {
        timestamp: new Date().toISOString()
      });
    }
  };

  const retryGuideGeneration = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    updateTaskStatus(taskId, {
      status: "generating",
      progress: 0,
    });

    try {
      if (!task.recommendedTool) {
        throw new Error("추천된 도구가 없습니다.");
      }

      const response = await fetch(`/api/tools/${task.recommendedTool.id}/guide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskContext: task.name,
          language: "ko",
          forceRefresh: true, // Force new generation
        }),
      });

      if (!response.ok) {
        throw new Error("가이드 생성 요청에 실패했습니다.");
      }

      updateTaskStatus(taskId, {
        status: "generating",
        progress: 50,
      });

      const guideData = await response.json();
      const markdownGuide = convertStructuredGuideToMarkdown(guideData, task);

      updateTaskStatus(taskId, {
        status: "completed",
        progress: 100,
        guide: markdownGuide,
      });

      onGuideGenerated(taskId, markdownGuide);

      toast({
        title: "가이드 재생성 완료",
        description: `${task.name}에 대한 가이드가 재생성되었습니다.`,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      
      updateTaskStatus(taskId, {
        status: "error",
        error: errorMessage,
      });

      // Notify parent component about the failure
      if (onGuideGenerationFailed) {
        onGuideGenerationFailed(taskId, errorMessage);
      }

      toast({
        title: "가이드 재생성 실패",
        description: `${task.name}에 대한 가이드 재생성 중 오류가 발생했습니다.`,
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: GuideGenerationStatus["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case "generating":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: GuideGenerationStatus["status"]) => {
    switch (status) {
      case "pending":
        return "대기 중";
      case "generating":
        return "생성 중";
      case "completed":
        return "완료";
      case "error":
        return "오류";
      default:
        return "대기 중";
    }
  };

  const getStatusColor = (status: GuideGenerationStatus["status"]) => {
    switch (status) {
      case "pending":
        return "bg-muted text-muted-foreground";
      case "generating":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "completed":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "error":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-900/20 to-indigo-900/20 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <motion.div
            className="flex justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6, type: "spring" }}
          >
            <motion.div
              className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center shadow-lg"
              animate={{
                scale: [1, 1.05, 1],
                boxShadow: [
                  "0 8px 16px rgba(59, 130, 246, 0.2)",
                  "0 16px 32px rgba(59, 130, 246, 0.4)",
                  "0 8px 16px rgba(59, 130, 246, 0.2)",
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: "reverse",
              }}
            >
              <BookOpen className="w-8 h-8 text-white" />
            </motion.div>
          </motion.div>

          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold text-blue-400">
              상세 실행 가이드 생성
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              각 작업에 대한 단계별 상세 가이드를 생성하여 성공률을 높이고 효율성을 극대화하세요.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              onClick={generateAllGuides}
              disabled={isGeneratingAll}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3 text-lg font-medium shadow-lg disabled:opacity-50"
            >
              {isGeneratingAll ? (
                <>
                  <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  모든 가이드 생성 중...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-3" />
                  모든 가이드 생성하기
                </>
              )}
            </Button>
          </motion.div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex gap-6 h-[600px]">
            {/* 서브태스크 뷰 - 40% 너비 */}
            <div className="flex-[4] space-y-4 overflow-y-auto pr-2">
              <h3 className="text-lg font-semibold text-foreground sticky top-0 bg-card z-10 pb-2">
                작업 목록
              </h3>
              {tasks.map((task, index) => {
                const status = generationStatuses[task.id] || {
                  status: "pending" as const,
                  progress: 0,
                  taskId: task.id,
                };

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                  >
                    <Card className="border border-border/50 bg-card/50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(status.status)}
                              <Badge
                                variant="outline"
                                className={`${getStatusColor(status.status)}`}
                              >
                                {getStatusText(status.status)}
                              </Badge>
                            </div>
                            <h4 className="font-medium text-foreground text-sm">
                              {task.name}
                            </h4>
                          </div>

                          <div className="flex items-center space-x-2">
                            {task.recommendedTool && (
                              <Badge variant="secondary" className="text-xs">
                                {task.recommendedTool.name}
                              </Badge>
                            )}
                            {status.status === "error" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => retryGuideGeneration(task.id)}
                                className="text-xs"
                              >
                                재시도
                              </Button>
                            )}
                          </div>
                        </div>

                        {status.status === "generating" && (
                          <div className="space-y-2">
                            <Progress value={status.progress} className="h-2" />
                            <p className="text-xs text-muted-foreground text-center">
                              가이드 생성 중... {status.progress}%
                            </p>
                          </div>
                        )}

                        {status.status === "completed" && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                가이드 생성 완료
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (status.guide) {
                                    onGuideGenerated(task.id, status.guide);
                                  }
                                }}
                                className="text-xs"
                              >
                                <Download className="w-3 h-3 mr-1" />
                                다운로드
                              </Button>
                            </div>
                          </motion.div>
                        )}

                        {status.status === "error" && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="space-y-2"
                          >
                            <div className="flex items-center space-x-2 text-red-500">
                              <AlertTriangle className="w-4 h-4" />
                              <span className="text-sm">{status.error}</span>
                            </div>
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* 가이드 뷰 - 60% 너비 */}
            <div className="flex-[6] border-l border-border/50 pl-6">
              <div className="h-full flex flex-col">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  생성된 가이드
                </h3>
                <div className="flex-1 overflow-y-auto">
                  {Object.keys(generationStatuses).length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center space-y-3">
                        <BookOpen className="w-12 h-12 mx-auto opacity-50" />
                        <p>가이드 생성을 시작하면 여기에 결과가 표시됩니다.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(generationStatuses).map(([taskId, status]) => {
                        const task = tasks.find(t => t.id === taskId);
                        if (!task || status.status !== "completed" || !status.guide) return null;
                        
                        return (
                          <motion.div
                            key={taskId}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-3"
                          >
                            <Card className="border border-green-500/20 bg-green-500/5">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-lg text-green-400 flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5" />
                                    {task.name}
                                  </CardTitle>
                                  <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                                    완료됨
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="bg-card/50 rounded-lg p-4 max-h-60 overflow-y-auto">
                                  <pre className="text-sm text-foreground/90 whitespace-pre-wrap font-mono">
                                    {status.guide.slice(0, 500)}...
                                  </pre>
                                </div>
                                <div className="mt-3 flex justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (status.guide) {
                                        onGuideGenerated(taskId, status.guide);
                                      }
                                    }}
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    전체 가이드 다운로드
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Helper function to convert structured guide to markdown
function convertStructuredGuideToMarkdown(guideData: any, task: Task): string {
  let markdown = `# ${task.name} - 상세 실행 가이드\n\n`;
  
  // Add task information
  markdown += `## 📋 작업 개요\n${task.name}\n\n`;
  
  // Add tool information
  if (task.recommendedTool) {
    markdown += `## 🛠️ 추천 도구\n`;
    markdown += `- **${task.recommendedTool.name}**\n`;
    if (task.recommendedTool.url) {
      markdown += `  - 링크: ${task.recommendedTool.url}\n`;
    }
    markdown += '\n';
  }
  
  // Add summary if available
  if (guideData.guide?.summary) {
    markdown += `## 📝 요약\n${guideData.guide.summary}\n\n`;
  }
  
  // Add sections
  if (guideData.guide?.sections) {
    guideData.guide.sections.forEach((section: any) => {
      markdown += `## ${section.title}\n`;
      
      if (section.content) {
        markdown += `${section.content}\n\n`;
      }
      
      if (section.steps && section.steps.length > 0) {
        section.steps.forEach((step: string, index: number) => {
          markdown += `${index + 1}. ${step}\n`;
        });
        markdown += '\n';
      }
    });
  }
  
  // Add source information
  if (guideData.sourceUrls && guideData.sourceUrls.length > 0) {
    markdown += `## 📚 참고 자료\n`;
    guideData.sourceUrls.forEach((url: string) => {
      markdown += `- [참고 링크](${url})\n`;
    });
    markdown += '\n';
  }
  
  // Add metadata
  const confidencePercentage = Math.round((guideData.confidenceScore || 0.6) * 100);
  markdown += `---\n*이 가이드는 AI에 의해 생성되었으며 (신뢰도: ${confidencePercentage}%), 실제 상황에 맞게 조정하여 사용하시기 바랍니다.*`;
  
  return markdown;
}
