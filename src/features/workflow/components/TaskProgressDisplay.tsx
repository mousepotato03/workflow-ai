"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  CheckCircle2, 
  Loader2, 
  Clock, 
  AlertCircle,
  Wrench,
  BookOpen,
  Sparkles
} from "lucide-react";
import { StreamState } from "@/hooks/useWorkflowStream";

interface TaskProgressDisplayProps {
  streamState: StreamState;
}

export function TaskProgressDisplay({ streamState }: TaskProgressDisplayProps) {
  const { taskProgress, isProcessing } = streamState;

  if (!isProcessing || taskProgress.size === 0) {
    return null;
  }

  const tasks = Array.from(taskProgress.values());

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'start':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'tool_complete':
        return <Wrench className="w-4 h-4 text-green-500" />;
      case 'guide_start':
        return <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />;
      case 'guide_complete':
        return <BookOpen className="w-4 h-4 text-green-500" />;
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStageText = (stage: string, toolName?: string) => {
    switch (stage) {
      case 'start':
        return '처리 시작';
      case 'tool_complete':
        return toolName ? `도구 추천: ${toolName}` : '도구 추천 완료';
      case 'guide_start':
        return '가이드 생성 중...';
      case 'guide_complete':
        return '가이드 생성 완료';
      case 'complete':
        return '완료';
      case 'error':
        return '오류 발생';
      default:
        return '대기 중';
    }
  };

  const getProgressColor = (stage: string) => {
    switch (stage) {
      case 'complete':
        return 'bg-green-500';
      case 'guide_complete':
        return 'bg-purple-500';
      case 'tool_complete':
        return 'bg-blue-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-300';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-md p-6 mb-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-purple-500" />
        <h3 className="text-lg font-semibold text-gray-900">
          작업 진행 상황
        </h3>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <motion.div
            key={task.taskId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
          >
            <div className="flex-shrink-0">
              {getStageIcon(task.stage)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {task.taskName}
                </p>
                <span className="text-xs text-gray-500">
                  {Math.round(task.progress)}%
                </span>
              </div>
              
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <motion.div
                    className={`h-2 rounded-full ${getProgressColor(task.stage)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${task.progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
              
              <p className="text-xs text-gray-600">
                {getStageText(task.stage, task.toolName)}
              </p>
              
              {task.hasGuide && (
                <div className="flex items-center gap-1 mt-1">
                  <BookOpen className="w-3 h-3 text-purple-500" />
                  <span className="text-xs text-purple-600">가이드 포함</span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            전체 진행률: {Math.round(streamState.progress)}%
          </span>
          <span className="text-gray-500">
            {tasks.filter(t => t.stage === 'complete').length} / {tasks.length} 완료
          </span>
        </div>
      </div>
    </motion.div>
  );
}