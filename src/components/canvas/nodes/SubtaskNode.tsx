"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Handle, Position } from "reactflow";
import {
  Sparkles,
  Edit3,
  Check,
  X,
  Wand2,
  Settings,
  BookOpen,
  Loader2,
  AlertCircle,
  Wrench,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SubtaskNodeProps, SubtaskNodeStatus } from "@/types/canvas";

/**
 * SubtaskNode Component
 *
 * The heart of the canvas - an intelligent node that interacts with FlowGenius AI
 * for tool recommendations and guide generation.
 *
 * Features:
 * - Task input area with inline editing
 * - Status indicators with animated states
 * - Tool slot displaying recommended tool with logo and name
 * - Control buttons for AI operations
 * - Progress indicators for async operations
 * - Error handling and retry mechanisms
 * - Connection handles for linking with guide cards
 */
export const SubtaskNode: React.FC<SubtaskNodeProps> = ({
  id,
  data,
  selected,
  onTaskUpdate,
  onGenerateRecommendation,
  onEditTool,
  onGenerateGuide,
  onStatusChange,
}) => {
  const [isEditing, setIsEditing] = useState(data.isEditing || false);
  const [taskText, setTaskText] = useState(data.taskDescription || "");
  const [isFocused, setIsFocused] = useState(false);
  const [showToolDetails, setShowToolDetails] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Handle edit mode toggle
  const handleEditToggle = useCallback(() => {
    setIsEditing(!isEditing);
  }, [isEditing]);

  // Handle task text save
  const handleSave = useCallback(() => {
    const trimmedTask = taskText.trim();
    if (trimmedTask !== data.taskDescription) {
      onTaskUpdate?.(trimmedTask);
    }
    setIsEditing(false);
  }, [taskText, data.taskDescription, onTaskUpdate]);

  // Handle cancel editing
  const handleCancel = useCallback(() => {
    setTaskText(data.taskDescription || "");
    setIsEditing(false);
  }, [data.taskDescription]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  // Handle double-click to edit
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isEditing && data.status === SubtaskNodeStatus.IDLE) {
        handleEditToggle();
      }
    },
    [isEditing, data.status, handleEditToggle]
  );

  // Get status-specific styling and content
  const getStatusInfo = useCallback(() => {
    switch (data.status) {
      case SubtaskNodeStatus.IDLE:
        return {
          color: "from-gray-500 to-slate-500",
          bgColor: "bg-gray-100",
          textColor: "text-gray-700",
          label: "Idle",
          icon: <Sparkles className="w-4 h-4" />,
          animated: false,
        };
      case SubtaskNodeStatus.ANALYZING:
        return {
          color: "from-amber-500 to-orange-500",
          bgColor: "bg-amber-50",
          textColor: "text-amber-800",
          label: "Analyzing",
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          animated: true,
        };
      case SubtaskNodeStatus.RECOMMENDED:
        return {
          color: "from-cyan-500 to-teal-500",
          bgColor: "bg-cyan-50",
          textColor: "text-cyan-800",
          label: "Recommended",
          icon: <Wand2 className="w-4 h-4" />,
          animated: false,
        };
      case SubtaskNodeStatus.GENERATING_GUIDE:
        return {
          color: "from-teal-500 to-cyan-500",
          bgColor: "bg-teal-50",
          textColor: "text-teal-800",
          label: "Generating Guide",
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          animated: true,
        };
      case SubtaskNodeStatus.GUIDE_GENERATED:
        return {
          color: "from-emerald-500 to-green-500",
          bgColor: "bg-emerald-50",
          textColor: "text-emerald-800",
          label: "Guide Generated",
          icon: <Check className="w-4 h-4" />,
          animated: false,
        };
      case SubtaskNodeStatus.ERROR:
        return {
          color: "from-red-500 to-rose-500",
          bgColor: "bg-red-50",
          textColor: "text-red-800",
          label: "Error",
          icon: <AlertCircle className="w-4 h-4" />,
          animated: false,
        };
      default:
        return {
          color: "from-gray-500 to-slate-500",
          bgColor: "bg-gray-100",
          textColor: "text-gray-700",
          label: "Unknown",
          icon: <Sparkles className="w-4 h-4" />,
          animated: false,
        };
    }
  }, [data.status]);

  const statusInfo = getStatusInfo();

  // Get available actions based on current status
  const getAvailableActions = useCallback(() => {
    const actions = [];

    if (
      data.status === SubtaskNodeStatus.IDLE &&
      data.taskDescription?.trim()
    ) {
      actions.push({
        key: "generate",
        label: "Generate Recommendations",
        icon: <Wand2 className="w-4 h-4" />,
        variant: "default" as const,
        onClick: onGenerateRecommendation,
        disabled: false,
      });
    }

    if (data.status === SubtaskNodeStatus.RECOMMENDED && data.recommendedTool) {
      actions.push(
        {
          key: "edit-tool",
          label: "Edit Tool",
          icon: <Settings className="w-4 h-4" />,
          variant: "outline" as const,
          onClick: onEditTool,
          disabled: false,
        },
        {
          key: "generate-guide",
          label: "Generate Guide",
          icon: <BookOpen className="w-4 h-4" />,
          variant: "default" as const,
          onClick: onGenerateGuide,
          disabled: false,
        }
      );
    }

    if (data.status === SubtaskNodeStatus.ERROR) {
      actions.push({
        key: "retry",
        label: "Retry",
        icon: <Sparkles className="w-4 h-4" />,
        variant: "outline" as const,
        onClick: onGenerateRecommendation,
        disabled: false,
      });
    }

    return actions;
  }, [
    data.status,
    data.taskDescription,
    data.recommendedTool,
    onGenerateRecommendation,
    onEditTool,
    onGenerateGuide,
  ]);

  const availableActions = getAvailableActions();

  return (
    <div
      className={cn(
        "relative bg-card border rounded-xl shadow-lg transition-all duration-200",
        "min-w-[220px] max-w-[300px]",
        selected &&
          "ring-2 ring-cyan-400/50 ring-offset-2 ring-offset-background",
        isFocused && "ring-2 ring-cyan-200",
        isEditing && "shadow-xl transform scale-[1.01]",
        statusInfo.animated && "animate-pulse"
      )}
      onDoubleClick={handleDoubleClick}
    >
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-white border-2 border-slate-400"
        style={{ top: -6 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-white border-2 border-cyan-500"
        style={{ bottom: -6 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-white border-2 border-cyan-500"
        style={{ right: -6 }}
      />

      {/* Header */}
      <div className="flex items-start justify-between p-3 pb-2">
        <div className="flex items-start space-x-2 flex-1">
          {/* Status Indicator */}
          <div
            className={cn(
              "w-8 h-8 bg-gradient-to-br rounded-lg flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0",
              statusInfo.color
            )}
          >
            {statusInfo.icon}
          </div>

          {/* Task Content */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  ref={textareaRef}
                  value={taskText}
                  onChange={(e) => setTaskText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Describe the task you want to accomplish..."
                  className="min-h-[50px] text-xs leading-relaxed resize-none"
                />

                {/* Edit Actions */}
                <div className="flex items-center justify-end space-x-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancel}
                    className="h-6 px-2 text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    className="h-6 px-2 text-xs"
                    disabled={!taskText.trim()}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-semibold text-foreground text-xs leading-tight">
                    {data.taskDescription || "Subtask"}
                  </h4>
                  {!isEditing && data.status === SubtaskNodeStatus.IDLE && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleEditToggle}
                      className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {/* Status Badge */}
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs",
                    statusInfo.bgColor,
                    statusInfo.textColor
                  )}
                >
                  {statusInfo.label}
                  {data.progress !== undefined &&
                    data.progress > 0 &&
                    data.progress < 100 && (
                      <span className="ml-2">({data.progress}%)</span>
                    )}
                </Badge>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tool Slot */}
      {data.recommendedTool && !isEditing && (
        <div className="mx-3 mb-3">
          <div className="bg-muted/30 border rounded-lg p-2">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowToolDetails(!showToolDetails)}
            >
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-sm border">
                  {data.recommendedTool.logoUrl ? (
                    <img
                      src={data.recommendedTool.logoUrl}
                      alt={data.recommendedTool.name}
                      className="w-4 h-4 object-contain"
                      onError={(e) => {
                        // Fallback to icon if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        const nextElement =
                          target.nextElementSibling as HTMLElement;
                        if (nextElement) {
                          nextElement.style.display = "block";
                        }
                      }}
                    />
                  ) : null}
                  <Wrench
                    className={`w-4 h-4 text-teal-600 ${
                      data.recommendedTool.logoUrl ? "hidden" : "block"
                    }`}
                  />
                </div>
                <div>
                  <p className="font-medium text-xs text-foreground">
                    {data.recommendedTool.name}
                  </p>
                  {data.recommendedTool.url ? (
                    <a
                      href={data.recommendedTool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Visit tool website
                    </a>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Recommended tool
                    </p>
                  )}
                </div>
              </div>
              {showToolDetails ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>

            {/* Tool Details */}
            {showToolDetails && (
              <div className="mt-3 pt-3 border-t space-y-2">
                {data.recommendationReason && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Why this tool:
                    </p>
                    <p className="text-xs text-foreground leading-relaxed">
                      {data.recommendationReason}
                    </p>
                  </div>
                )}
                {data.confidence !== undefined && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Confidence:
                    </p>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 rounded-full transition-all duration-500"
                          style={{ width: `${data.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(data.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {data.status === SubtaskNodeStatus.ERROR &&
        data.errorMessage &&
        !isEditing && (
          <div className="mx-4 mb-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 leading-relaxed">
                  {data.errorMessage}
                </p>
              </div>
            </div>
          </div>
        )}

      {/* Control Buttons */}
      {availableActions.length > 0 && !isEditing && (
        <div className="px-3 pb-3">
          <div className="flex flex-wrap gap-1">
            {availableActions.map((action) => (
              <Button
                key={action.key}
                size="sm"
                variant={action.variant}
                onClick={action.onClick}
                disabled={action.disabled}
                className="text-xs h-7 px-2 flex-1 min-w-0"
              >
                {action.icon}
                <span className="ml-1 truncate">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State Help */}
      {!data.taskDescription?.trim() && !isEditing && (
        <div className="px-3 pb-3">
          <div className="bg-muted/30 rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground mb-2">
              Double-click to describe your task
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleEditToggle}
              className="text-xs h-6"
            >
              <Edit3 className="w-3 h-3 mr-1" />
              Add Task
            </Button>
          </div>
        </div>
      )}

      {/* Node Info */}
      {selected && (
        <div className="absolute -bottom-8 left-0 right-0 text-center">
          <div className="bg-card border rounded-md px-2 py-1 shadow-lg text-xs text-muted-foreground inline-block">
            Subtask Node • ID: {id}
          </div>
        </div>
      )}
    </div>
  );
};

SubtaskNode.displayName = "SubtaskNode";

export default SubtaskNode;
