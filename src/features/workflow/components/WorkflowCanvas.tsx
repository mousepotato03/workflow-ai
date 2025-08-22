"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  CheckCircle2,
  Sparkles,
  ArrowDown,
  Target,
  RotateCcw,
  AlertCircle,
  ExternalLink,
  GripVertical,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  RefreshCw,
  BookOpen,
  FileText,
  Star,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useWorkflowStore } from "../hooks/useWorkflowStore";

export function WorkflowCanvas() {
  const {
    workflowResult,
    isLoading,
    userGoal,
    selectedTask,
    isGeneratingGuides,
    generatedGuides,
    clearWorkflow,
    setWorkflowResult,
    setSelectedTask,
    addTask,
    updateTask,
    deleteTask,
    generateGuides,
    retryGuideGeneration,
  } = useWorkflowStore();
  const [draggedTask, setDraggedTask] = React.useState<string | null>(null);
  const [dragOverTask, setDragOverTask] = React.useState<string | null>(null);
  const [editingTask, setEditingTask] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState("");
  const [isAddingTask, setIsAddingTask] = React.useState(false);
  const [newTaskText, setNewTaskText] = React.useState("");
  const [rematchingTasks, setRematchingTasks] = React.useState<Set<string>>(
    new Set()
  );
  const [layoutMode, setLayoutMode] = React.useState<"horizontal" | "vertical">(
    "horizontal"
  );
  const [leftPanelWidth, setLeftPanelWidth] = React.useState(50); // 50% default
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = React.useState(false);

  const handleNewWorkflow = () => {
    clearWorkflow();
    setLayoutMode("horizontal"); // Reset layout mode
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleProceedToGuides = async () => {
    // Change layout to vertical immediately
    setLayoutMode("vertical");

    // Start guide generation immediately
    await generateGuides();

    // Scroll to guide section after everything is settled
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }, 100);
  };

  const getWorkflowStatus = () => {
    if (isLoading) return "Analyzing your goal...";
    if (workflowResult) return "Planning completed";
    return "Ready to start";
  };

  const getCompletedTasksCount = () => {
    if (!workflowResult) return 0;
    // Since tasks don't have status, we'll assume all are completed when workflow status is completed
    return workflowResult.status === "completed"
      ? workflowResult.tasks.length
      : 0;
  };

  const getProgressPercentage = () => {
    if (!workflowResult) return 0;
    const completed = getCompletedTasksCount();
    return Math.round((completed / workflowResult.tasks.length) * 100);
  };

  const areAllGuidesCompleted = () => {
    if (!workflowResult || generatedGuides.size === 0) return false;
    return workflowResult.tasks.every(task => {
      const guide = generatedGuides.get(task.id);
      return guide?.status === "completed";
    });
  };

  // Task editing handlers
  const handleEditStart = (taskId: string, currentName: string) => {
    setEditingTask(taskId);
    setEditingText(currentName);
  };

  const handleEditSave = () => {
    if (editingTask && editingText.trim()) {
      updateTask(editingTask, editingText.trim());
    }
    setEditingTask(null);
    setEditingText("");
  };

  const handleEditCancel = () => {
    setEditingTask(null);
    setEditingText("");
  };

  const handleAddTask = () => {
    if (newTaskText.trim()) {
      addTask(newTaskText.trim());
      setNewTaskText("");
      setIsAddingTask(false);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask(taskId);
  };

  const handleTaskClick = (taskId: string) => {
    if (layoutMode === "vertical") {
      setSelectedTask(taskId);
    }
  };

  const handleRematchTool = async (taskId: string, taskName: string) => {
    if (!workflowResult) return;

    setRematchingTasks((prev) => new Set(prev).add(taskId));

    try {
      const response = await fetch("/api/workflow/rematch-tool", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId,
          taskName,
          language: "ko", // or get from user preference
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to rematch tool.");
      }

      const result = await response.json();

      // Update the specific task with new tool recommendation
      const updatedTasks = workflowResult.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              recommendedTool: result.recommendedTool,
              recommendationReason: result.recommendationReason,
              confidence: result.confidence,
            }
          : task
      );

      setWorkflowResult({
        ...workflowResult,
        tasks: updatedTasks,
      });
    } catch (error) {
      // You could add a toast notification here
    } finally {
      setRematchingTasks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, taskId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTask(taskId);
  };

  const handleDragLeave = () => {
    setDragOverTask(null);
  };

  const handleDrop = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();

    if (!draggedTask || !workflowResult || draggedTask === targetTaskId) {
      setDraggedTask(null);
      setDragOverTask(null);
      return;
    }

    const tasks = [...workflowResult.tasks];
    const draggedIndex = tasks.findIndex((task) => task.id === draggedTask);
    const targetIndex = tasks.findIndex((task) => task.id === targetTaskId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Swap the tasks
    const draggedTaskData = tasks[draggedIndex];
    const targetTaskData = tasks[targetIndex];

    // Update order values
    const tempOrder = draggedTaskData.order;
    draggedTaskData.order = targetTaskData.order;
    targetTaskData.order = tempOrder;

    // Swap positions in array
    tasks[draggedIndex] = targetTaskData;
    tasks[targetIndex] = draggedTaskData;

    // Update the workflow result
    setWorkflowResult({
      ...workflowResult,
      tasks: tasks.sort((a, b) => a.order - b.order),
    });

    setDraggedTask(null);
    setDragOverTask(null);
  };

  return (
    <div className="bg-background">
      {/* Canvas Container - Card Style */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 pb-8">
        <div
          className="max-w-none mx-auto bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-800 dark:via-indigo-900 dark:to-purple-900 rounded-3xl shadow-2xl border border-border overflow-hidden 
                       w-[calc(100vw-2rem)] sm:w-[calc(100vw-3rem)] lg:w-[calc(100vw-4rem)] xl:w-[calc(100vw-6rem)]"
        >
          {/* Header - Inside Card */}
          <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-4 sm:pb-6 border-b-2 border-white/30 dark:border-slate-600/50 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                  </div>
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">
                    WorkFlow Canvas
                  </h1>
                </div>

                <div className="hidden md:flex items-center space-x-3 bg-white/20 dark:bg-slate-800/50 backdrop-blur-sm rounded-full px-4 py-2">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-sm text-foreground">
                        {getWorkflowStatus()}
                      </span>
                    </>
                  ) : workflowResult ? (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-sm" />
                      <span className="text-sm text-green-600 font-medium">
                        {getWorkflowStatus()}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-slate-500 rounded-full" />
                      <span className="text-sm text-muted-foreground">
                        {getWorkflowStatus()}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <Button
                onClick={handleNewWorkflow}
                variant="outline"
                size="sm"
                className="shadow-lg transition-all duration-200 hover:scale-105 border-white/30 dark:border-slate-600"
              >
                <RotateCcw className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">New Task</span>
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/40 dark:border-slate-600/60"></div>
            </div>
            <div className="relative flex justify-center">
              <div className="bg-white/50 dark:bg-slate-700/50 px-4 py-1 rounded-full backdrop-blur-sm">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area - Inside Card */}
          <div className="p-4 sm:p-6 lg:p-8 xl:p-12">
            {/* Loading State - Show main node immediately when loading */}
            {isLoading && (
              <div className="space-y-8" data-workflow-canvas>
                {/* Show Main Task Node immediately even during loading */}
                <div
                  className={`flex gap-8 items-start ${
                    layoutMode === "vertical"
                      ? "flex-col"
                      : "flex-col lg:flex-row"
                  }`}
                >
                  {/* Main Task Node - Always visible during loading */}
                  <motion.div
                    className={`bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-4 sm:p-6 shadow-2xl border border-primary/20 w-full ${
                      layoutMode === "vertical" ? "max-w-none" : "max-w-sm"
                    }`}
                    layout
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  >
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-bold text-white text-lg">
                        Main Goal
                      </h3>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                      <p
                        className="text-white/90 text-sm leading-relaxed overflow-hidden"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {userGoal
                          ? userGoal.length > 60
                            ? `${userGoal.substring(0, 60)}...`
                            : userGoal
                          : "Analyzing user goal..."}
                      </p>
                    </div>
                  </motion.div>

                  {/* Connection Arrow - Conditional Display */}
                  <motion.div
                    className={`${
                      layoutMode === "vertical"
                        ? "flex items-center justify-center py-4"
                        : "hidden lg:flex items-center justify-center py-4"
                    }`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                  >
                    <div className="flex items-center space-x-2">
                      <motion.div
                        className="w-12 h-px bg-gradient-to-r from-primary to-indigo-400"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        style={{ originX: 0 }}
                      />
                      <motion.div
                        animate={{
                          y: [0, -2, 0],
                          scale: [1, 1.1, 1],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          repeatType: "reverse",
                        }}
                      >
                        <ArrowDown
                          className={`w-5 h-5 text-indigo-400 transition-transform duration-300 ${
                            layoutMode === "vertical" ? "" : "rotate-90"
                          }`}
                        />
                      </motion.div>
                      <motion.div
                        className="w-12 h-px bg-gradient-to-r from-indigo-400 to-purple-400"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.6, delay: 0.5 }}
                        style={{ originX: 1 }}
                      />
                    </div>
                  </motion.div>

                  {/* Subtasks Container - Loading state */}
                  <motion.div
                    className="flex-1"
                    layout
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  >
                    <motion.div
                      className="bg-muted/30 border-2 border-dashed border-muted-foreground/40 rounded-3xl p-4 sm:p-8 backdrop-blur-sm min-h-[400px] h-full"
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4, delay: 0.3 }}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                            <Sparkles className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-foreground">
                              Sub Tasks
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              AI is analyzing optimal tasks...
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Loading animation for subtasks only */}
                      <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <div className="w-16 h-16 border-4 border-indigo-200 dark:border-indigo-800 rounded-full animate-spin border-t-indigo-500"></div>
                        <p className="text-lg font-medium text-muted-foreground">
                          Creating subtasks...
                        </p>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                          AI is analyzing the optimal workflow
                        </p>
                      </div>
                    </motion.div>
                  </motion.div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !workflowResult && (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 lg:py-20 space-y-6 sm:space-y-8">
                <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/30 rounded-3xl flex items-center justify-center shadow-xl">
                  <Target className="w-12 h-12 text-primary" />
                </div>
                <div className="text-center space-y-3 sm:space-y-4">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
                    Start Your Workflow
                  </h2>
                  <p className="text-muted-foreground max-w-md text-base sm:text-lg px-4 sm:px-0">
                    Enter your goal in the form above and AI will design the
                    optimal workflow for you.
                  </p>
                </div>
              </div>
            )}

            {/* Workflow Canvas */}
            {!isLoading && workflowResult && (
              <div className="space-y-8" data-workflow-canvas>
                {/* Dynamic Layout: Main Node + Subtask Container */}
                <div
                  className={`flex gap-8 items-start ${
                    layoutMode === "vertical"
                      ? "flex-col"
                      : "flex-col lg:flex-row"
                  }`}
                >
                  {/* Main Task Node */}
                  <motion.div
                    className={`bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-4 sm:p-6 shadow-2xl border border-primary/20 w-full ${
                      layoutMode === "vertical" ? "max-w-none" : "max-w-sm"
                    }`}
                    whileHover={{
                      scale: 1.02,
                      transition: { duration: 0.2 },
                    }}
                  >
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-bold text-white text-lg">
                        Main Goal
                      </h3>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                      <p
                        className="text-white/90 text-sm leading-relaxed overflow-hidden"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {userGoal
                          ? userGoal.length > 60
                            ? `${userGoal.substring(0, 60)}...`
                            : userGoal
                          : "Analyzing user goal..."}
                      </p>
                    </div>
                  </motion.div>

                  {/* Subtasks and Guide View Container - Vertical Layout Only */}
                    {layoutMode === "vertical" ? (
                      <div
                        className="flex flex-col lg:flex-row gap-8 w-full"
                      >
                        {/* Subtasks Container */}
                        <motion.div
                          className={isLeftPanelCollapsed ? "overflow-hidden" : ""}
                          style={{ 
                            width: isLeftPanelCollapsed ? '0%' : `${leftPanelWidth}%`,
                            minWidth: isLeftPanelCollapsed ? '0px' : '200px'
                          }}
                          animate={{
                            width: isLeftPanelCollapsed ? '0%' : `${leftPanelWidth}%`,
                            opacity: isLeftPanelCollapsed ? 0 : 1
                          }}
                          transition={{
                            duration: 0.3,
                            ease: [0.4, 0.0, 0.2, 1]
                          }}
                        >
                          <div className="bg-muted/30 border-2 border-dashed border-muted-foreground/40 rounded-3xl p-4 sm:p-8 backdrop-blur-sm min-h-[400px] h-full">
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                                  <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <h3 className="text-xl font-bold text-foreground">
                                    Sub Tasks
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    {workflowResult.tasks.length} optimized
                                    steps
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <Button
                                  onClick={() => setIsLeftPanelCollapsed(true)}
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </Button>
                                {(layoutMode as string) === "horizontal" && (
                                  <Button
                                    onClick={() => setIsAddingTask(true)}
                                    size="sm"
                                    variant="outline"
                                    className="border-primary/30 text-primary hover:bg-primary/10"
                                  >
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add Task
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Subtask Nodes - Vertical Layout */}
                            {workflowResult &&
                            workflowResult.status === "completed" ? (
                              <div className="flex flex-col gap-6">
                                {workflowResult.tasks.map((task, index) => (
                                  <div key={task.id} className="relative">
                                    {/* Subtask Node */}
                                    <div
                                      draggable={(layoutMode as string) === "horizontal"}
                                      onDragStart={(layoutMode as string) === "horizontal" ? (e) => handleDragStart(e, task.id) : undefined}
                                      onDragOver={(layoutMode as string) === "horizontal" ? (e) => handleDragOver(e, task.id) : undefined}
                                      onDragLeave={(layoutMode as string) === "horizontal" ? handleDragLeave : undefined}
                                      onDrop={(layoutMode as string) === "horizontal" ? (e) => handleDrop(e, task.id) : undefined}
                                      onClick={() => handleTaskClick(task.id)}
                                      className={`group bg-card border rounded-xl p-5 shadow-lg transition-all duration-200 ${layoutMode === "vertical" ? "cursor-pointer" : "cursor-pointer"} ${
                                        draggedTask === task.id
                                          ? "opacity-50 scale-105 border-primary shadow-2xl"
                                          : dragOverTask === task.id
                                          ? "border-primary border-2 shadow-xl scale-105"
                                          : selectedTask === task.id &&
                                            layoutMode === "vertical"
                                          ? "border-primary border-2 shadow-xl bg-primary/5"
                                          : "border-border hover:shadow-xl hover:scale-[1.02]"
                                      }`}
                                    >
                                      <div className="flex items-start space-x-4">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0">
                                          {task.order}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between mb-2">
                                            {editingTask === task.id ? (
                                              <div className="flex items-center space-x-2 flex-1">
                                                <Input
                                                  value={editingText}
                                                  onChange={(e) =>
                                                    setEditingText(
                                                      e.target.value
                                                    )
                                                  }
                                                  className="flex-1 text-sm"
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter")
                                                      handleEditSave();
                                                    if (e.key === "Escape")
                                                      handleEditCancel();
                                                  }}
                                                  autoFocus
                                                />
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={handleEditSave}
                                                  className="p-1 h-auto"
                                                >
                                                  <Check className="w-4 h-4 text-green-600" />
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={handleEditCancel}
                                                  className="p-1 h-auto"
                                                >
                                                  <X className="w-4 h-4 text-red-600" />
                                                </Button>
                                              </div>
                                            ) : (
                                              <>
                                                <h4 className="font-semibold text-foreground text-base leading-tight flex-1">
                                                  {task.name}
                                                </h4>
                                                <div className="flex items-center space-x-1">
                                                  {(layoutMode as string) === "horizontal" && (
                                                    <>
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                          handleRematchTool(
                                                            task.id,
                                                            task.name
                                                          )
                                                        }
                                                        className="p-1 h-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                                        disabled={rematchingTasks.has(
                                                          task.id
                                                        )}
                                                      >
                                                        {rematchingTasks.has(
                                                          task.id
                                                        ) ? (
                                                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                                        ) : (
                                                          <RefreshCw className="w-4 h-4 text-muted-foreground hover:text-blue-600" />
                                                        )}
                                                      </Button>
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                          handleEditStart(
                                                            task.id,
                                                            task.name
                                                          )
                                                        }
                                                        className="p-1 h-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                                      >
                                                        <Edit3 className="w-4 h-4 text-muted-foreground hover:text-primary" />
                                                      </Button>
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                          handleDeleteTask(task.id)
                                                        }
                                                        className="p-1 h-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                                      >
                                                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-600" />
                                                      </Button>
                                                      <GripVertical className="w-5 h-5 text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing" />
                                                    </>
                                                  )}
                                                </div>
                                              </>
                                            )}
                                          </div>

                                          {task.recommendedTool && (
                                            <div className="bg-muted/50 border rounded-lg p-3 mt-2">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                  {task.recommendedTool
                                                    .logoUrl && (
                                                    <img
                                                      src={
                                                        task.recommendedTool
                                                          .logoUrl
                                                      }
                                                      alt={
                                                        task.recommendedTool
                                                          .name
                                                      }
                                                      className="w-5 h-5 rounded object-cover"
                                                      onError={(e) => {
                                                        const target =
                                                          e.target as HTMLImageElement;
                                                        target.style.display =
                                                          "none";
                                                      }}
                                                    />
                                                  )}
                                                  <span className="text-sm font-medium text-foreground">
                                                    {task.recommendedTool.name}
                                                  </span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                  {(() => {
                                                    const guideStatus =
                                                      generatedGuides.get(
                                                        task.id
                                                      );
                                                    if (
                                                      guideStatus?.status ===
                                                      "completed"
                                                    ) {
                                                      return (
                                                        <div className="flex items-center space-x-1 text-xs text-emerald-600">
                                                          <CheckCircle2 className="w-3 h-3" />
                                                          <span>
                                                            Guide Ready
                                                          </span>
                                                        </div>
                                                      );
                                                    }
                                                    if (
                                                      guideStatus?.status ===
                                                      "generating"
                                                    ) {
                                                      return (
                                                        <div className="flex items-center space-x-1 text-xs text-blue-600">
                                                          <Loader2 className="w-3 h-3 animate-spin" />
                                                          <span>
                                                            Generating...
                                                          </span>
                                                        </div>
                                                      );
                                                    }
                                                    if (
                                                      guideStatus?.status ===
                                                      "error"
                                                    ) {
                                                      return (
                                                        <div className="flex items-center space-x-1 text-xs text-red-600">
                                                          <AlertCircle className="w-3 h-3" />
                                                          <span>Error</span>
                                                        </div>
                                                      );
                                                    }
                                                    return null;
                                                  })()}
                                                  <Button
                                                    onClick={() =>
                                                      window.open(
                                                        task.recommendedTool!
                                                          .url,
                                                        "_blank"
                                                      )
                                                    }
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-xs px-2 py-1 h-auto"
                                                  >
                                                    <ExternalLink className="w-3 h-3 mr-1" />
                                                    Use
                                                  </Button>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Connection Lines between subtasks */}
                                    {index <
                                      workflowResult.tasks.length - 1 && (
                                      <motion.div
                                        className="flex items-center justify-center py-4"
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{
                                          duration: 0.4,
                                          delay: 0.2 + index * 0.1,
                                          type: "spring",
                                          stiffness: 200,
                                        }}
                                      >
                                        <motion.div
                                          animate={{
                                            y: [0, -3, 0],
                                            opacity: [0.6, 1, 0.6],
                                          }}
                                          transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            repeatType: "reverse",
                                            delay: index * 0.3,
                                          }}
                                        >
                                          <ArrowDown className="w-6 h-6 text-indigo-400" />
                                        </motion.div>
                                      </motion.div>
                                    )}
                                  </div>
                                ))}

                                {/* Add New Task - Vertical Layout */}
                                {isAddingTask && (
                                  <div className="bg-card border-2 border-dashed border-primary/40 rounded-xl p-5 shadow-lg">
                                    <div className="flex items-center space-x-4">
                                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0">
                                        +
                                      </div>
                                      <div className="flex-1 space-y-3">
                                        <Input
                                          value={newTaskText}
                                          onChange={(e) =>
                                            setNewTaskText(e.target.value)
                                          }
                                          placeholder="Enter new task name..."
                                          className="w-full"
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter")
                                              handleAddTask();
                                            if (e.key === "Escape")
                                              setIsAddingTask(false);
                                          }}
                                          autoFocus
                                        />
                                        <div className="flex items-center space-x-2">
                                          <Button
                                            size="sm"
                                            onClick={handleAddTask}
                                            disabled={!newTaskText.trim()}
                                            className="bg-green-600 hover:bg-green-700 text-white"
                                          >
                                            <Check className="w-4 h-4 mr-1" />
                                            Add Task
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setIsAddingTask(false);
                                              setNewTaskText("");
                                            }}
                                          >
                                            <X className="w-4 h-4 mr-1" />
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : workflowResult &&
                              workflowResult.status !== "completed" ? (
                              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                <div className="w-16 h-16 border-4 border-indigo-200 dark:border-indigo-800 rounded-full animate-spin border-t-indigo-500"></div>
                                <p className="text-lg font-medium text-muted-foreground">
                                  Creating subtasks...
                                </p>
                                <p className="text-sm text-muted-foreground text-center max-w-md">
                                  AI is analyzing the optimal workflow
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </motion.div>

                        {/* Resizable Divider */}
                        {!isLeftPanelCollapsed && (
                          <div
                            className="relative flex items-center justify-center w-2 cursor-col-resize group hover:bg-primary/20 transition-colors duration-200"
                            onMouseDown={(e) => {
                              const startX = e.clientX;
                              const startWidth = leftPanelWidth;
                              const containerWidth = e.currentTarget.parentElement?.offsetWidth || 1000;

                              const handleMouseMove = (e: MouseEvent) => {
                                const deltaX = e.clientX - startX;
                                const deltaPercentage = (deltaX / containerWidth) * 100;
                                const newWidth = Math.max(20, Math.min(80, startWidth + deltaPercentage));
                                setLeftPanelWidth(newWidth);
                              };

                              const handleMouseUp = () => {
                                document.removeEventListener('mousemove', handleMouseMove);
                                document.removeEventListener('mouseup', handleMouseUp);
                              };

                              document.addEventListener('mousemove', handleMouseMove);
                              document.addEventListener('mouseup', handleMouseUp);
                            }}
                          >
                            <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-1 bg-border group-hover:bg-primary transition-colors duration-200 rounded-full" />
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-8 bg-background border border-border rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg">
                              <GripVertical className="w-3 h-3 text-muted-foreground" />
                            </div>
                          </div>
                        )}

                        {/* Guide View Container */}
                        <motion.div
                          style={{ 
                            width: isLeftPanelCollapsed ? '100%' : `${100 - leftPanelWidth}%`,
                            flex: '1'
                          }}
                        >
                          <div className="bg-muted/30 border-2 border-dashed border-muted-foreground/40 rounded-3xl p-4 sm:p-8 backdrop-blur-sm min-h-[400px] h-full">
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
                                  <BookOpen className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <h3 className="text-xl font-bold text-foreground">
                                    Task Guide
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    Detailed implementation guide
                                  </p>
                                </div>
                              </div>
                              {isLeftPanelCollapsed && (
                                <Button
                                  onClick={() => setIsLeftPanelCollapsed(false)}
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                  <span className="ml-1 text-xs">Show Tasks</span>
                                </Button>
                              )}
                            </div>

                            {/* Guide Content */}
                            {isGeneratingGuides ? (
                              /* Loading State */
                              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                                <div className="w-16 h-16 border-4 border-emerald-200 dark:border-emerald-800 rounded-full animate-spin border-t-emerald-500"></div>
                                <div className="text-center space-y-2">
                                  <h4 className="text-lg font-medium text-foreground">
                                    Generating guides...
                                  </h4>
                                  <p className="text-sm text-muted-foreground max-w-xs">
                                    AI is creating detailed implementation
                                    guides for each task.
                                  </p>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {
                                    Array.from(generatedGuides.values()).filter(
                                      (g) => g.status === "completed"
                                    ).length
                                  }{" "}
                                  / {workflowResult?.tasks.length || 0}{" "}
                                  completed
                                </div>
                              </div>
                            ) : selectedTask &&
                              generatedGuides.has(selectedTask) ? (
                              /* Selected Task Guide */
                              (() => {
                                const guide = generatedGuides.get(selectedTask);
                                const task = workflowResult?.tasks.find(
                                  (t) => t.id === selectedTask
                                );

                                if (!guide || !task) return null;

                                if (guide?.status === "error") {
                                  return (
                                    <div className="flex flex-col items-center justify-center py-16 space-y-4">
                                      <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 rounded-2xl flex items-center justify-center">
                                        <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                                      </div>
                                      <div className="text-center space-y-2">
                                        <h4 className="text-lg font-medium text-foreground">
                                          Guide generation failed
                                        </h4>
                                        <p className="text-sm text-red-600 dark:text-red-400 max-w-xs">
                                          {guide?.error ||
                                            "Unknown error occurred"}
                                        </p>
                                      </div>
                                      <Button
                                        onClick={() =>
                                          retryGuideGeneration(selectedTask)
                                        }
                                        variant="outline"
                                        size="sm"
                                        disabled={false}
                                      >
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Retry
                                      </Button>
                                    </div>
                                  );
                                }

                                if (guide?.status === "generating") {
                                  return (
                                    <div className="flex flex-col items-center justify-center py-16 space-y-4">
                                      <div className="w-16 h-16 border-4 border-emerald-200 dark:border-emerald-800 rounded-full animate-spin border-t-emerald-500"></div>
                                      <div className="text-center space-y-2">
                                        <h4 className="text-lg font-medium text-foreground">
                                          Generating guide for {task.name}
                                        </h4>
                                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-emerald-500 transition-all duration-300"
                                            style={{
                                              width: `${guide?.progress || 0}%`,
                                            }}
                                          />
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          {guide?.progress || 0}% complete
                                        </p>
                                      </div>
                                    </div>
                                  );
                                }

                                if (
                                  guide?.status === "completed" &&
                                  guide?.guide
                                ) {
                                  return (
                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                          <h4 className="text-lg font-medium text-foreground">
                                            {task.name}
                                          </h4>
                                        </div>
                                        {task.recommendedTool && (
                                          <Button
                                            onClick={() =>
                                              window.open(
                                                task.recommendedTool!.url,
                                                "_blank"
                                              )
                                            }
                                            size="sm"
                                            variant="outline"
                                          >
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                            Open Tool
                                          </Button>
                                        )}
                                      </div>
                                      <div className="prose prose-sm max-w-none dark:prose-invert">
                                        <div className="space-y-4 text-sm leading-relaxed">
                                          <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                              h1: ({ children }) => (
                                                <h2 className="text-lg font-bold text-foreground mt-6 mb-3">
                                                  {children}
                                                </h2>
                                              ),
                                              h2: ({ children }) => (
                                                <h3 className="text-base font-semibold text-foreground mt-4 mb-2">
                                                  {children}
                                                </h3>
                                              ),
                                              h3: ({ children }) => (
                                                <h4 className="text-sm font-medium text-foreground mt-3 mb-1">
                                                  {children}
                                                </h4>
                                              ),
                                              ul: ({ children }) => (
                                                <ul className="space-y-1 ml-4">
                                                  {children}
                                                </ul>
                                              ),
                                              ol: ({ children }) => (
                                                <ol className="space-y-2 list-none">
                                                  {children}
                                                </ol>
                                              ),
                                              li: ({ children }) => (
                                                <li className="ml-4 mb-2">
                                                  {children}
                                                </li>
                                              ),
                                              p: ({ children }) => (
                                                <p className="mb-2 leading-relaxed">
                                                  {children}
                                                </p>
                                              ),
                                              code: ({
                                                children,
                                                className,
                                              }) => {
                                                const isInline = !className;
                                                if (isInline) {
                                                  return (
                                                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">
                                                      {children}
                                                    </code>
                                                  );
                                                }
                                                return (
                                                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto border">
                                                    <code className="text-sm font-mono text-foreground">
                                                      {children}
                                                    </code>
                                                  </pre>
                                                );
                                              },
                                              blockquote: ({ children }) => (
                                                <blockquote className="border-l-4 border-primary/30 pl-4 py-2 italic text-muted-foreground bg-muted/30 rounded-r">
                                                  {children}
                                                </blockquote>
                                              ),
                                              strong: ({ children }) => (
                                                <strong className="font-semibold text-foreground">
                                                  {children}
                                                </strong>
                                              ),
                                              em: ({ children }) => (
                                                <em className="italic text-muted-foreground">
                                                  {children}
                                                </em>
                                              ),
                                              a: ({ children, href }) => (
                                                <a
                                                  href={href}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-primary hover:text-primary/80 underline underline-offset-2"
                                                >
                                                  {children}
                                                </a>
                                              ),
                                            }}
                                          >
                                            {guide?.guide || ""}
                                          </ReactMarkdown>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }

                                return null;
                              })()
                            ) : (
                              /* Empty State - No Task Selected */
                              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                                <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-2xl flex items-center justify-center">
                                  <FileText className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div className="text-center space-y-2">
                                  <h4 className="text-lg font-medium text-foreground">
                                    {generatedGuides.size > 0
                                      ? "Select a task to view its guide"
                                      : "Generate guides first"}
                                  </h4>
                                  <p className="text-sm text-muted-foreground max-w-xs">
                                    {generatedGuides.size > 0
                                      ? "Choose a task from the left to see detailed implementation steps and recommendations."
                                      : "Click 'Generate Guides with Tools' to find tools and create AI-powered implementation guides for each task."}
                                  </p>
                                </div>
                                {generatedGuides.size === 0 && (
                                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                    <Star className="w-4 h-4" />
                                    <span>AI-powered guides available</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </div>
                    ) : null}

                  {/* Horizontal Layout - Original Subtasks Container */}
                    {layoutMode === "horizontal" && (
                      <div
                        className="flex-1"
                      >
                        <div className="bg-muted/30 border-2 border-dashed border-muted-foreground/40 rounded-3xl p-4 sm:p-8 backdrop-blur-sm min-h-[400px] h-full">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                                <Sparkles className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-foreground">
                                  Sub Tasks
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  {workflowResult.tasks.length} optimized steps
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Button
                                onClick={() => setIsAddingTask(true)}
                                size="sm"
                                variant="outline"
                                className="border-primary/30 text-primary hover:bg-primary/10"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Task
                              </Button>
                            </div>
                          </div>

                          {/* Subtask Nodes */}
                          {workflowResult &&
                          workflowResult.status === "completed" ? (
                            <div
                              className={`gap-6 ${
                                (layoutMode as string) === "vertical"
                                  ? "flex flex-col"
                                  : "grid grid-cols-1 lg:grid-cols-2"
                              }`}
                            >
                              {workflowResult.tasks.map((task, index) => (
                                <div key={task.id} className="relative">
                                  {/* Subtask Node */}
                                  <div
                                    draggable
                                    onDragStart={(e) =>
                                      handleDragStart(e, task.id)
                                    }
                                    onDragOver={(e) =>
                                      handleDragOver(e, task.id)
                                    }
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, task.id)}
                                    onClick={() => handleTaskClick(task.id)}
                                    className={`group bg-card border rounded-xl p-5 shadow-lg transition-all duration-200 cursor-pointer ${
                                      draggedTask === task.id
                                        ? "opacity-50 scale-105 border-primary shadow-2xl"
                                        : dragOverTask === task.id
                                        ? "border-primary border-2 shadow-xl scale-105"
                                        : selectedTask === task.id &&
                                          (layoutMode as string) === "vertical"
                                        ? "border-primary border-2 shadow-xl bg-primary/5"
                                        : "border-border hover:shadow-xl hover:scale-[1.02]"
                                    }`}
                                  >
                                    <div className="flex items-start space-x-4">
                                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0">
                                        {task.order}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-2">
                                          {editingTask === task.id ? (
                                            <div className="flex items-center space-x-2 flex-1">
                                              <Input
                                                value={editingText}
                                                onChange={(e) =>
                                                  setEditingText(e.target.value)
                                                }
                                                className="flex-1 text-sm"
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter")
                                                    handleEditSave();
                                                  if (e.key === "Escape")
                                                    handleEditCancel();
                                                }}
                                                autoFocus
                                              />
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={handleEditSave}
                                                className="p-1 h-auto"
                                              >
                                                <Check className="w-4 h-4 text-green-600" />
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={handleEditCancel}
                                                className="p-1 h-auto"
                                              >
                                                <X className="w-4 h-4 text-red-600" />
                                              </Button>
                                            </div>
                                          ) : (
                                            <>
                                              <h4 className="font-semibold text-foreground text-base leading-tight flex-1">
                                                {task.name}
                                              </h4>
                                              <div className="flex items-center space-x-1">
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() =>
                                                    handleRematchTool(
                                                      task.id,
                                                      task.name
                                                    )
                                                  }
                                                  className="p-1 h-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                                  disabled={rematchingTasks.has(
                                                    task.id
                                                  )}
                                                >
                                                  {rematchingTasks.has(
                                                    task.id
                                                  ) ? (
                                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                                  ) : (
                                                    <RefreshCw className="w-4 h-4 text-muted-foreground hover:text-blue-600" />
                                                  )}
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() =>
                                                    handleEditStart(
                                                      task.id,
                                                      task.name
                                                    )
                                                  }
                                                  className="p-1 h-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                  <Edit3 className="w-4 h-4 text-muted-foreground hover:text-primary" />
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() =>
                                                    handleDeleteTask(task.id)
                                                  }
                                                  className="p-1 h-auto opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                  <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-600" />
                                                </Button>
                                                <GripVertical className="w-5 h-5 text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing" />
                                              </div>
                                            </>
                                          )}
                                        </div>

                                        {task.recommendedTool && (
                                          <div className="bg-muted/50 border rounded-lg p-3 mt-2">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center space-x-2">
                                                {task.recommendedTool
                                                  .logoUrl && (
                                                  <img
                                                    src={
                                                      task.recommendedTool
                                                        .logoUrl
                                                    }
                                                    alt={
                                                      task.recommendedTool.name
                                                    }
                                                    className="w-5 h-5 rounded object-cover"
                                                    onError={(e) => {
                                                      const target =
                                                        e.target as HTMLImageElement;
                                                      target.style.display =
                                                        "none";
                                                    }}
                                                  />
                                                )}
                                                <span className="text-sm font-medium text-foreground">
                                                  {task.recommendedTool.name}
                                                </span>
                                              </div>
                                              <div className="flex items-center space-x-2">
                                                {(() => {
                                                  const guideStatus =
                                                    generatedGuides.get(
                                                      task.id
                                                    );
                                                  if (
                                                    guideStatus?.status ===
                                                    "completed"
                                                  ) {
                                                    return (
                                                      <div className="flex items-center space-x-1 text-xs text-emerald-600">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        <span>Guide Ready</span>
                                                      </div>
                                                    );
                                                  }
                                                  if (
                                                    guideStatus?.status ===
                                                    "generating"
                                                  ) {
                                                    return (
                                                      <div className="flex items-center space-x-1 text-xs text-blue-600">
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                        <span>
                                                          Generating...
                                                        </span>
                                                      </div>
                                                    );
                                                  }
                                                  if (
                                                    guideStatus?.status ===
                                                    "error"
                                                  ) {
                                                    return (
                                                      <div className="flex items-center space-x-1 text-xs text-red-600">
                                                        <AlertCircle className="w-3 h-3" />
                                                        <span>Error</span>
                                                      </div>
                                                    );
                                                  }
                                                  return null;
                                                })()}
                                                <Button
                                                  onClick={() =>
                                                    window.open(
                                                      task.recommendedTool!.url,
                                                      "_blank"
                                                    )
                                                  }
                                                  size="sm"
                                                  variant="outline"
                                                  className="text-xs px-2 py-1 h-auto"
                                                >
                                                  <ExternalLink className="w-3 h-3 mr-1" />
                                                  Use
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Connection Lines between subtasks */}
                                  {index < workflowResult.tasks.length - 1 &&
                                    index % 2 === 0 && (
                                      <motion.div
                                        className="absolute top-1/2 -right-3 transform -translate-y-1/2 lg:hidden"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{
                                          duration: 0.5,
                                          delay: 0.3 + index * 0.1,
                                          type: "spring",
                                        }}
                                      >
                                        <motion.div
                                          animate={{
                                            x: [0, 2, 0],
                                            scale: [1, 1.1, 1],
                                          }}
                                          transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            repeatType: "reverse",
                                            delay: index * 0.2,
                                          }}
                                        >
                                          <ChevronRight className="w-6 h-6 text-indigo-400" />
                                        </motion.div>
                                      </motion.div>
                                    )}
                                </div>
                              ))}

                              {/* Add New Task */}
                              {isAddingTask && (
                                <div className="bg-card border-2 border-dashed border-primary/40 rounded-xl p-5 shadow-lg">
                                  <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0">
                                      +
                                    </div>
                                    <div className="flex-1 space-y-3">
                                      <Input
                                        value={newTaskText}
                                        onChange={(e) =>
                                          setNewTaskText(e.target.value)
                                        }
                                        placeholder="Enter new task name..."
                                        className="w-full"
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            handleAddTask();
                                          if (e.key === "Escape")
                                            setIsAddingTask(false);
                                        }}
                                        autoFocus
                                      />
                                      <div className="flex items-center space-x-2">
                                        <Button
                                          size="sm"
                                          onClick={handleAddTask}
                                          disabled={!newTaskText.trim()}
                                          className="bg-green-600 hover:bg-green-700 text-white"
                                        >
                                          <Check className="w-4 h-4 mr-1" />
                                          Add Task
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setIsAddingTask(false);
                                            setNewTaskText("");
                                          }}
                                        >
                                          <X className="w-4 h-4 mr-1" />
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : workflowResult &&
                            workflowResult.status !== "completed" ? (
                            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                              <div className="w-16 h-16 border-4 border-indigo-200 dark:border-indigo-800 rounded-full animate-spin border-t-indigo-500"></div>
                              <p className="text-lg font-medium text-muted-foreground">
                                Creating subtasks...
                              </p>
                              <p className="text-sm text-muted-foreground text-center max-w-md">
                                AI is analyzing the optimal workflow
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                </div>

                {/* Completion Celebration */}
                <AnimatePresence>
                  {getProgressPercentage() === 100 && (
                    <motion.div
                      className="mt-8"
                      initial={{ opacity: 0, scale: 0.8, y: 30 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -30 }}
                      transition={{
                        duration: 0.6,
                        type: "spring",
                        stiffness: 200,
                      }}
                    >
                      <motion.div
                        className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-700 rounded-2xl p-6 shadow-2xl backdrop-blur-sm"
                        whileHover={{
                          scale: 1.02,
                          boxShadow:
                            "0 25px 50px -12px rgba(34, 197, 94, 0.25)",
                        }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
                          <div className="flex items-center space-x-4">
                            <motion.div
                              className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg"
                              animate={{
                                scale: [1, 1.2, 1],
                                rotate: [0, 360],
                              }}
                              transition={{
                                scale: {
                                  duration: 2,
                                  repeat: Infinity,
                                  repeatType: "reverse",
                                },
                                rotate: {
                                  duration: 3,
                                  repeat: Infinity,
                                  ease: "linear",
                                },
                              }}
                            >
                              <CheckCircle2 className="w-6 h-6 text-white" />
                            </motion.div>
                            <div>
                              <motion.h3
                                className="text-xl font-bold text-green-900 dark:text-green-100"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                              >
                                Planning Finished!
                              </motion.h3>
                              <motion.p
                                className="text-green-700 dark:text-green-300"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: 0.3 }}
                              >
                                All {workflowResult.tasks.length} steps have
                                been successfully mapped.
                              </motion.p>
                            </div>
                          </div>
                          {!areAllGuidesCompleted() && (
                            <motion.div
                              className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3"
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.5, delay: 0.4 }}
                            >
                              <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <Button
                                  onClick={handleProceedToGuides}
                                  disabled={isGeneratingGuides}
                                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-70 relative overflow-hidden"
                                >
                                  <AnimatePresence mode="wait">
                                    {isGeneratingGuides ? (
                                      <motion.span
                                        key="generating"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className="flex items-center"
                                      >
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Generating Guides...
                                      </motion.span>
                                    ) : (
                                      <motion.span
                                        key="ready"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        className="flex items-center"
                                      >
                                        <BookOpen className="w-4 h-4 mr-2" />
                                        Generate Guides with Tools
                                      </motion.span>
                                    )}
                                  </AnimatePresence>
                                </Button>
                              </motion.div>
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
