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
} from "lucide-react";

interface Tool {
  id: string;
  name: string;
  description?: string;
  category?: string;
  url?: string;
  logo_url?: string;
  confidence_score?: number;
}

interface Task {
  id: string;
  name: string;
  description: string;
  tools: Tool[];
  estimated_duration?: string;
  priority?: "high" | "medium" | "low";
}

interface GuideGenerationSectionProps {
  tasks: Task[];
  onGuideGenerated: (taskId: string, guide: string) => void;
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
    if (!task.tools || task.tools.length === 0) {
      updateTaskStatus(task.id, {
        status: "error",
        error: "이 작업에는 추천된 도구가 없습니다.",
      });
      return;
    }

    const primaryTool = task.tools[0]; // Use the first tool as primary

    updateTaskStatus(task.id, {
      status: "generating",
      progress: 0,
    });

    try {
      // First check if cached guide exists
      const cachedResponse = await fetch(
        `/api/tools/${primaryTool.id}/guide?taskContext=${encodeURIComponent(
          task.description
        )}&language=ko`
      );

      if (cachedResponse.ok) {
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
        return;
      }

      // If no cached guide, generate new one with streaming
      const streamResponse = await fetch(
        `/api/tools/${primaryTool.id}/guide/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            taskContext: task.description,
            language: "ko",
          }),
        }
      );

      if (!streamResponse.ok) {
        throw new Error("가이드 생성 요청에 실패했습니다.");
      }

      const reader = streamResponse.body?.getReader();
      if (!reader) {
        throw new Error("스트림을 읽을 수 없습니다.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.trim() === "") continue;

            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              try {
                const dataStr = line.slice(6).trim();
                const data = JSON.parse(dataStr);

                if (currentEvent === "progress") {
                  updateTaskStatus(task.id, {
                    status: "generating",
                    progress: data.progress,
                  });
                } else if (currentEvent === "complete") {
                  const markdownGuide = convertStructuredGuideToMarkdown(
                    data,
                    task
                  );

                  updateTaskStatus(task.id, {
                    status: "completed",
                    progress: 100,
                    guide: markdownGuide,
                  });

                  onGuideGenerated(task.id, markdownGuide);
                  return;
                } else if (currentEvent === "error") {
                  throw new Error(data.error);
                }
              } catch (parseError) {
                console.warn("Failed to parse stream data:", line, parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error("Guide generation error:", error);
      updateTaskStatus(task.id, {
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.",
      });

      toast({
        title: "가이드 생성 실패",
        description: `${task.name} 작업의 가이드 생성에 실패했습니다.`,
        variant: "destructive",
      });
    }
  };

  const generateAllGuides = async () => {
    setIsGeneratingAll(true);

    try {
      // Initialize all tasks as pending
      const initialStatuses: Record<string, GuideGenerationStatus> = {};
      tasks.forEach((task) => {
        initialStatuses[task.id] = {
          taskId: task.id,
          status: "pending",
          progress: 0,
        };
      });
      setGenerationStatuses(initialStatuses);

      // Generate guides sequentially to avoid rate limiting
      for (const task of tasks) {
        await generateGuideForTask(task);
        // Add small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      toast({
        title: "가이드 생성 완료",
        description: "모든 작업의 상세 가이드가 생성되었습니다.",
      });
    } catch (error) {
      toast({
        title: "가이드 생성 중 오류",
        description: "일부 가이드 생성에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const convertStructuredGuideToMarkdown = (
    guideData: any,
    task: Task
  ): string => {
    let markdown = `# ${task.name} - 상세 실행 가이드\n\n`;

    // Add task description
    markdown += `## 📋 작업 개요\n${task.description}\n\n`;

    // Add tool information
    if (task.tools && task.tools.length > 0) {
      markdown += `## 🛠️ 추천 도구\n`;
      task.tools.forEach((tool) => {
        markdown += `- **${tool.name}**: ${
          tool.description || "이 작업에 최적화된 도구"
        }\n`;
        if (tool.url) {
          markdown += `  - 링크: ${tool.url}\n`;
        }
      });
      markdown += "\n";
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
          markdown += "\n";
        }
      });
    }

    // Add source information
    if (guideData.sourceUrls && guideData.sourceUrls.length > 0) {
      markdown += `## 📚 참고 자료\n`;
      guideData.sourceUrls.forEach((url: string) => {
        markdown += `- [참고 링크](${url})\n`;
      });
      markdown += "\n";
    }

    // Add metadata
    const confidencePercentage = Math.round(
      (guideData.confidenceScore || 0.6) * 100
    );
    markdown += `---\n*이 가이드는 AI에 의해 생성되었으며 (신뢰도: ${confidencePercentage}%), 실제 상황에 맞게 조정하여 사용하시기 바랍니다.*`;

    return markdown;
  };

  const completedCount = Object.values(generationStatuses).filter(
    (s) => s.status === "completed"
  ).length;
  const totalCount = tasks.length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-900/20 to-purple-900/20">
        <CardHeader>
          <motion.div
            className="flex items-center justify-between"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="flex items-center gap-3">
              <motion.div
                className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.5, delay: 0.2, type: "spring" }}
              >
                <BookOpen className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  <CardTitle className="text-xl text-blue-400">
                    Detailed Guide Generation
                  </CardTitle>
                </motion.div>
                <motion.p
                  className="text-sm text-blue-300/80"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                >
                  Generate step-by-step guides for each task with AI-powered
                  insights
                </motion.p>
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              whileHover={{ scale: isGeneratingAll ? 1 : 1.05 }}
              whileTap={{ scale: isGeneratingAll ? 1 : 0.95 }}
            >
              <Button
                onClick={generateAllGuides}
                disabled={isGeneratingAll}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 relative overflow-hidden"
              >
                <AnimatePresence mode="wait">
                  {isGeneratingAll ? (
                    <motion.span
                      key="generating"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center"
                    >
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </motion.span>
                  ) : (
                    <motion.span
                      key="ready"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center"
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      Generate All Guides
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Generating background effect */}
                {isGeneratingAll && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-blue-400/20 -translate-x-full"
                    animate={{ translateX: "200%" }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                )}
              </Button>
            </motion.div>
          </motion.div>

          {totalCount > 0 && (
            <motion.div
              className="mt-4"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <motion.div
                className="flex items-center justify-between text-sm text-muted-foreground mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.6 }}
              >
                <span>Progress</span>
                <motion.span
                  key={`${completedCount}-${totalCount}`}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {completedCount} / {totalCount} completed
                </motion.span>
              </motion.div>
              <Progress
                value={(completedCount / totalCount) * 100}
                className="h-2"
              />
            </motion.div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <motion.div
            variants={{
              show: {
                transition: {
                  staggerChildren: 0.1,
                },
              },
            }}
            initial="hidden"
            animate="show"
          >
            {tasks.map((task, index) => {
              const status = generationStatuses[task.id];
              const primaryTool = task.tools?.[0];

              return (
                <motion.div
                  key={task.id}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    show: { opacity: 1, y: 0 },
                  }}
                  layout
                  transition={{ duration: 0.4 }}
                >
                  <Card className="border border-border/50 overflow-hidden">
                    <CardContent className="p-4 relative">
                      {/* Status color indicator */}
                      <motion.div
                        className={`absolute left-0 top-0 bottom-0 w-1 ${
                          status?.status === "completed"
                            ? "bg-green-500"
                            : status?.status === "generating"
                            ? "bg-blue-500"
                            : status?.status === "error"
                            ? "bg-red-500"
                            : "bg-muted-foreground/20"
                        }`}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                        style={{ originY: 0 }}
                      />

                      <motion.div
                        className="flex items-start justify-between pl-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.2 }}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <motion.h4
                              className="font-semibold"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, delay: 0.3 }}
                            >
                              {task.name}
                            </motion.h4>

                            <AnimatePresence mode="wait">
                              {status?.status === "completed" && (
                                <motion.div
                                  key="completed"
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{ duration: 0.3, type: "spring" }}
                                >
                                  <Badge
                                    variant="default"
                                    className="bg-green-500/20 text-green-400 border-green-500/30"
                                  >
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Complete
                                  </Badge>
                                </motion.div>
                              )}
                              {status?.status === "error" && (
                                <motion.div
                                  key="error"
                                  initial={{
                                    scale: 0,
                                    opacity: 0,
                                    rotate: -10,
                                  }}
                                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{ duration: 0.3, type: "spring" }}
                                >
                                  <Badge variant="destructive">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Error
                                  </Badge>
                                </motion.div>
                              )}
                              {status?.status === "generating" && (
                                <motion.div
                                  key="generating"
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{ duration: 0.3, type: "spring" }}
                                >
                                  <Badge variant="secondary">
                                    <motion.div
                                      animate={{ rotate: 360 }}
                                      transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        ease: "linear",
                                      }}
                                    >
                                      <Loader2 className="w-3 h-3 mr-1" />
                                    </motion.div>
                                    Generating
                                  </Badge>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <motion.p
                            className="text-sm text-muted-foreground mb-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3, delay: 0.4 }}
                          >
                            {task.description}
                          </motion.p>

                          {primaryTool && (
                            <motion.div
                              className="flex items-center gap-2 text-xs text-muted-foreground"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: 0.5 }}
                            >
                              <span>Primary Tool:</span>
                              <Badge variant="outline" className="text-xs">
                                {primaryTool.name}
                              </Badge>
                            </motion.div>
                          )}

                          <AnimatePresence>
                            {status?.status === "generating" && (
                              <motion.div
                                className="mt-3"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                <Progress
                                  value={status.progress}
                                  className="h-1"
                                />
                                <motion.p
                                  className="text-xs text-muted-foreground mt-1"
                                  key={status.progress}
                                  initial={{ scale: 1.1, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  {status.progress}% complete
                                </motion.p>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <AnimatePresence>
                            {status?.error && (
                              <motion.div
                                className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive"
                                initial={{ opacity: 0, scale: 0.95, x: -10 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95, x: -10 }}
                                transition={{ duration: 0.3 }}
                              >
                                {status.error}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <motion.div
                          className="flex gap-2 ml-4"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: 0.3 }}
                        >
                          <AnimatePresence>
                            {(!status ||
                              status.status === "pending" ||
                              status.status === "error") && (
                              <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => generateGuideForTask(task)}
                                  disabled={!primaryTool || isGeneratingAll}
                                >
                                  <BookOpen className="w-3 h-3 mr-1" />
                                  Generate
                                </Button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
