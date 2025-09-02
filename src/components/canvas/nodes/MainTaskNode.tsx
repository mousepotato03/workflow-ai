"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, NodeResizer } from "reactflow";
import { Target, Lock, Move } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MainTaskNodeProps } from "@/types/canvas";

/**
 * MainTaskNode Component
 *
 * The central node of the workflow canvas that displays and allows editing
 * of the main user goal. This node cannot be deleted or duplicated.
 *
 * Features:
 * - Editable goal text with inline editing
 * - Visual lock indicator (cannot be deleted)
 * - Connection handles for linking to subtask nodes
 * - Gradient styling consistent with existing design
 * - Auto-resize based on content
 */

export const MainTaskNode: React.FC<MainTaskNodeProps> = ({
  id,
  data,
  selected,
  onGoalUpdate,
  onEditToggle,
}) => {
  const [goalText, setGoalText] = useState(data.goal || "");
  const [nodeSize, setNodeSize] = useState({ width: 320, height: 120 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle goal text change
  const handleGoalChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setGoalText(e.target.value);
    },
    []
  );

  // Handle goal text save
  const handleSave = useCallback(() => {
    const trimmedGoal = goalText.trim();
    if (trimmedGoal !== data.goal) {
      onGoalUpdate?.(trimmedGoal);
    }
  }, [goalText, data.goal, onGoalUpdate]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
        textareaRef.current?.blur();
      }
    },
    [handleSave]
  );

  // Handle textarea click to prevent event bubbling
  const handleTextareaClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Handle node resize
  const handleResize = useCallback((event: any, data: { width: number; height: number }) => {
    setNodeSize({ width: data.width, height: data.height });
  }, []);

  // Auto-resize textarea when content changes
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    }
  }, [goalText, nodeSize]);

  return (
    <>
      <NodeResizer
        minWidth={320}
        minHeight={120}
        maxWidth={800}
        maxHeight={400}
        isVisible={selected}
        lineClassName="border-2 border-teal-400"
        handleClassName="w-4 h-4 bg-teal-400 border-2 border-white shadow-lg hover:bg-teal-500 hover:scale-110 transition-all cursor-nw-resize"
        onResize={handleResize}
      />
      <div
        className={cn(
          "relative bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl shadow-lg border border-teal-300/30 transition-all duration-200",
          "min-w-[320px] max-w-[800px] w-full h-full flex flex-col",
          selected &&
            "ring-2 ring-teal-400/50 ring-offset-1 ring-offset-background"
        )}
      >
      {/* Connection Handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-white border-2 border-teal-500"
        style={{ bottom: -6 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-white border-2 border-teal-500"
        style={{ right: -6 }}
      />
      <Handle
        type="source"
        position={Position.Left}
        className="w-3 h-3 bg-white border-2 border-teal-500"
        style={{ left: -6 }}
      />

      {/* Header - Drag Handle */}
      <div 
        className="flex items-center justify-between p-2 pb-1 cursor-move react-flow__drag-handle"
        title="Drag to move node"
      >
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
            <Target className="w-3 h-3 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-xs">Main Goal</h3>
            <p className="text-white/70 text-xs">Primary objective</p>
          </div>
        </div>
        <div className="opacity-60 hover:opacity-100 transition-opacity">
          <Move className="w-3 h-3 text-white/60" />
        </div>
      </div>

      {/* Content Area */}
      <div className="px-2 pb-2 flex-1 flex flex-col min-h-0">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 flex-1 flex flex-col min-h-[50px]">
          <Textarea
            ref={textareaRef}
            value={goalText}
            onChange={handleGoalChange}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            onClick={handleTextareaClick}
            placeholder="Enter your main workflow goal..."
            className="bg-transparent border-none shadow-none focus-visible:ring-0 text-white placeholder:text-white/60 text-xs resize-none overflow-y-auto flex-1 p-0 leading-relaxed w-full"
            style={{
              minHeight: `${Math.max(14, nodeSize.height - 80)}px`,
              maxHeight: `${nodeSize.height - 80}px`,
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              if (target.scrollHeight <= nodeSize.height - 80) {
                target.style.height = "auto";
                target.style.height = target.scrollHeight + "px";
              }
            }}
          />
        </div>
      </div>
      </div>
    </>
  );
};

MainTaskNode.displayName = "MainTaskNode";

export default MainTaskNode;
