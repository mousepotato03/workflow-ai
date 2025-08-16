"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
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
  BookOpen,
  Download,
  FileText,
  Zap,
} from "lucide-react";
import { useWorkflowStore } from "../hooks/useWorkflowStore";
import { TaskCard } from "./TaskCard";
import { GuideGenerationSection } from "./GuideGenerationSection";

export function WorkflowResultDisplay() {
  const { workflowResult, isLoading, clearWorkflow } = useWorkflowStore();
  const { toast } = useToast();
  const [showGuideGeneration, setShowGuideGeneration] = useState(false);
  const [generatedGuides, setGeneratedGuides] = useState<
    Record<string, string>
  >({});

  const handleStartOver = () => {
    clearWorkflow();
  };

  const handleProceedToGuides = () => {
    setShowGuideGeneration(true);
  };

  const handleGuideGenerated = (taskId: string, guide: string) => {
    setGeneratedGuides((prev) => ({
      ...prev,
      [taskId]: guide,
    }));
  };

  const handleDownloadTaskGuide = (taskId: string, taskName: string) => {
    const guide = generatedGuides[taskId];
    if (guide) {
      const blob = new Blob([guide], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${taskName.replace(/[^a-zA-Z0-9]/g, "-")}-guide.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // No result state
  if (!workflowResult || !workflowResult.tasks) {
    return null;
  }

  const taskCount = workflowResult.tasks.length;

  // Success state
  return (
    <motion.div
      className="mt-8 space-y-6"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
    >
      {/* Workflow Completion Celebration */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
      >
        <Card className="border-2 border-green-500/20 bg-gradient-to-br from-green-900/20 to-emerald-900/20 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              <motion.div
                className="flex justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  duration: 0.8,
                  delay: 0.5,
                  type: "spring",
                  stiffness: 200,
                }}
              >
                <motion.div
                  className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg"
                  animate={{
                    scale: [1, 1.1, 1],
                    boxShadow: [
                      "0 10px 20px rgba(34, 197, 94, 0.2)",
                      "0 20px 40px rgba(34, 197, 94, 0.4)",
                      "0 10px 20px rgba(34, 197, 94, 0.2)",
                    ],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatType: "reverse",
                  }}
                >
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </motion.div>
              </motion.div>

              <motion.div
                className="space-y-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.7 }}
              >
                <motion.h2
                  className="text-3xl font-bold text-green-400"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                >
                  Workflow Complete!
                </motion.h2>
                <motion.p
                  className="text-lg text-green-300/80 max-w-2xl mx-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.9 }}
                >
                  Your workflow has been successfully created with {taskCount}{" "}
                  optimized tasks. Each step includes recommended tools and
                  basic guidance.
                </motion.p>
              </motion.div>

              {!showGuideGeneration && (
                <motion.div
                  className="bg-card/80 rounded-xl p-6 border border-green-500/30 max-w-2xl mx-auto"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 1.0 }}
                >
                  <motion.div
                    className="flex items-center justify-center space-x-3 mb-4"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 1.1 }}
                  >
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 3,
                      }}
                    >
                      <Sparkles className="w-6 h-6 text-yellow-400" />
                    </motion.div>
                    <h3 className="text-xl font-semibold text-foreground">
                      Ready for the Next Step?
                    </h3>
                  </motion.div>
                  <motion.p
                    className="text-muted-foreground mb-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 1.2 }}
                  >
                    Generate detailed, step-by-step guides for each task to
                    maximize your success and efficiency.
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 1.3 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      onClick={handleProceedToGuides}
                      size="lg"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 text-lg font-medium shadow-lg"
                    >
                      <BookOpen className="w-5 h-5 mr-3" />
                      Generate Detailed Guides
                    </Button>
                  </motion.div>
                </motion.div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Guide Generation Section */}
      {showGuideGeneration && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <GuideGenerationSection
            tasks={workflowResult.tasks}
            onGuideGenerated={handleGuideGenerated}
          />
        </motion.div>
      )}

      {/* Tasks */}
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
      >
        <motion.div
          className="flex items-center justify-between"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <h3 className="text-2xl font-bold text-foreground">
            Your Workflow Tasks
          </h3>
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7, type: "spring" }}
          >
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20"
            >
              {taskCount} Tasks
            </Badge>
          </motion.div>
        </motion.div>
        <motion.div
          className="grid gap-6"
          variants={{
            show: {
              transition: {
                staggerChildren: 0.15,
              },
            },
          }}
          initial="hidden"
          animate="show"
        >
          {workflowResult.tasks.map((task, index) => (
            <motion.div
              key={task.id || `task-${index}`}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.6 }}
            >
              <TaskCard
                task={task}
                hasDetailedGuide={!!generatedGuides[task.id || `task-${index}`]}
                onDownloadGuide={() =>
                  handleDownloadTaskGuide(task.id || `task-${index}`, task.name)
                }
              />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.9 }}
      >
        <Separator className="my-6 bg-border" />
      </motion.div>

      <motion.div
        className="flex justify-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.0 }}
      >
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={handleStartOver}
            variant="outline"
            size="lg"
            className="px-8"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Start New Workflow
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
