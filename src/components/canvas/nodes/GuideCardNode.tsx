"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Handle, Position, NodeResizer } from "reactflow";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Edit3,
  Check,
  X,
  Copy,
  ExternalLink,
  Wrench,
  Sparkles,
  FileText,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { GuideCardNodeProps } from "@/types/canvas";
import ReactMarkdown from "react-markdown";

/**
 * GuideCardNode Component
 *
 * A specialized node for displaying detailed implementation guides with
 * collapsible content and markdown support.
 *
 * Features:
 * - Collapsible guide content with smooth animations
 * - Markdown rendering for rich text formatting
 * - Inline content editing capabilities
 * - Copy and external link actions
 * - Associated tool information display
 * - Multiple size modes (collapsed, normal, expanded)
 * - Connection handles for linking with subtask nodes
 */
export const GuideCardNode: React.FC<GuideCardNodeProps> = ({
  id,
  data,
  selected,
  onContentUpdate,
  onCollapseToggle,
  onEditContent,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [contentText, setContentText] = useState(data.content || "");
  const [isExpanded, setIsExpanded] = useState(false); // Full-screen mode
  const [isFocused, setIsFocused] = useState(false);
  const [nodeSize, setNodeSize] = useState({ width: 260, height: 120 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Handle collapse toggle
  const handleCollapseToggle = useCallback(() => {
    const newCollapsedState = !data.isCollapsed;
    onCollapseToggle?.(newCollapsedState);
  }, [data.isCollapsed, onCollapseToggle]);

  // Handle expand toggle (full-screen mode)
  const handleExpandToggle = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  // Handle edit mode toggle
  const handleEditToggle = useCallback(() => {
    if (data.isEditable) {
      setIsEditing(!isEditing);
    }
  }, [isEditing, data.isEditable]);

  // Handle content save
  const handleSave = useCallback(() => {
    const trimmedContent = contentText.trim();
    if (trimmedContent !== data.content) {
      onContentUpdate?.(trimmedContent);
      onEditContent?.(trimmedContent);
    }
    setIsEditing(false);
  }, [contentText, data.content, onContentUpdate, onEditContent]);

  // Handle cancel editing
  const handleCancel = useCallback(() => {
    setContentText(data.content || "");
    setIsEditing(false);
  }, [data.content]);

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

  // Handle node resize
  const handleResize = useCallback((event: any, data: { width: number; height: number }) => {
    setNodeSize({ width: data.width, height: data.height });
  }, []);

  // Handle copy content to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(data.content || "");
      // TODO: Show toast notification
    } catch (err) {
      console.error("Failed to copy content:", err);
    }
  }, [data.content]);

  // Get generation status info
  const getGenerationStatusInfo = useCallback(() => {
    if (data.generationStatus) {
      switch (data.generationStatus.status) {
        case "generating":
          return {
            label: "Generating...",
            color: "bg-amber-100 text-amber-800",
            icon: <Sparkles className="w-3 h-3 animate-pulse" />,
          };
        case "completed":
          return {
            label: "Generated",
            color: "bg-green-100 text-green-800",
            icon: <Check className="w-3 h-3" />,
          };
        case "error":
          return {
            label: "Error",
            color: "bg-red-100 text-red-800",
            icon: <X className="w-3 h-3" />,
          };
        default:
          return null;
      }
    }
    return null;
  }, [data.generationStatus]);

  const generationStatus = getGenerationStatusInfo();

  return (
    <>
      {!isExpanded && (
        <NodeResizer
          minWidth={220}
          minHeight={120}
          maxWidth={500}
          maxHeight={700}
          isVisible={selected}
          lineClassName="border-emerald-400"
          handleClassName="w-3 h-3 bg-emerald-400 border-2 border-white"
          onResize={handleResize}
        />
      )}
      <div
        className={cn(
          "relative bg-card border rounded-xl shadow-lg transition-all duration-200",
          data.isCollapsed ? "min-w-[220px]" : "min-w-[260px] w-full h-full",
          !data.isCollapsed && !isExpanded && "max-w-[500px]",
          isExpanded && "fixed inset-4 z-50 max-w-none max-h-none",
          selected &&
            "ring-2 ring-emerald-400/50 ring-offset-2 ring-offset-background",
          isFocused && "ring-2 ring-emerald-200",
          isEditing && "shadow-xl"
        )}
      >
      {/* Expanded Mode Overlay */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={handleExpandToggle}
        />
      )}

      {/* Connection Handles */}
      {!isExpanded && (
        <>
          <Handle
            type="target"
            position={Position.Top}
            className="w-3 h-3 bg-white border-2 border-emerald-500"
            style={{ top: -6 }}
          />
          <Handle
            type="target"
            position={Position.Left}
            className="w-3 h-3 bg-white border-2 border-emerald-500"
            style={{ left: -6 }}
          />
        </>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-emerald-50/50 dark:bg-emerald-900/20">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-800 rounded-lg flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-semibold text-foreground text-xs truncate">
                {data.title || "Implementation Guide"}
              </h4>
              {generationStatus && (
                <Badge
                  variant="secondary"
                  className={cn("text-xs", generationStatus.color)}
                >
                  {generationStatus.icon}
                  <span className="ml-1">{generationStatus.label}</span>
                </Badge>
              )}
            </div>

            {data.tool && (
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <Wrench className="w-3 h-3" />
                <span>for {data.tool.name}</span>
                {data.isUserModified && (
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    Modified
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-1">
          {data.content && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="h-6 w-6 p-0"
              title="Copy content"
            >
              <Copy className="w-3 h-3" />
            </Button>
          )}

          {data.isEditable && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleEditToggle}
              className="h-6 w-6 p-0"
              title="Edit content"
            >
              <Edit3 className="w-3 h-3" />
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={handleExpandToggle}
            className="h-6 w-6 p-0"
            title={isExpanded ? "Exit full screen" : "Full screen"}
          >
            {isExpanded ? (
              <Minimize2 className="w-3 h-3" />
            ) : (
              <Maximize2 className="w-3 h-3" />
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleCollapseToggle}
            className="h-6 w-6 p-0"
            title={data.isCollapsed ? "Expand guide" : "Collapse guide"}
          >
            {data.isCollapsed ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronUp className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Content Area */}
      {!data.isCollapsed && (
        <div
          className={cn(
            "transition-all duration-300 ease-in-out",
            isExpanded ? "flex-1 flex flex-col min-h-0" : ""
          )}
        >
          {isEditing ? (
            <div className="p-3 space-y-2 flex-1 flex flex-col">
              <div className="flex-1">
                <Textarea
                  ref={textareaRef}
                  value={contentText}
                  onChange={(e) => setContentText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Enter your guide content (Markdown supported)..."
                  className="text-xs leading-relaxed resize-none font-mono overflow-y-auto"
                  style={{
                    minHeight: isExpanded ? "400px" : `${Math.max(150, nodeSize.height - 200)}px`,
                    maxHeight: isExpanded ? "none" : `${Math.max(200, nodeSize.height - 150)}px`,
                  }}
                />
              </div>

              {/* Edit Actions */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-xs text-muted-foreground">
                  Supports Markdown formatting
                </div>
                <div className="flex items-center space-x-1">
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
                    disabled={!contentText.trim()}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Save
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground text-center">
                Ctrl+Enter to save • Escape to cancel
              </div>
            </div>
          ) : (
            <div
              className={cn(isExpanded ? "flex-1 flex flex-col min-h-0" : "")}
            >
              {data.content ? (
                <ScrollArea
                  className={cn("p-3", isExpanded ? "flex-1" : "max-h-[300px]")}
                >
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown
                      components={{
                        // Custom components for better styling
                        h1: ({ children }) => (
                          <h1 className="text-sm font-bold mb-2 text-foreground">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-xs font-semibold mb-2 text-foreground">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-xs font-semibold mb-1 text-foreground">
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => (
                          <p className="text-xs text-foreground leading-relaxed mb-2">
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className="text-xs text-foreground space-y-1 mb-2 pl-3">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="text-xs text-foreground space-y-1 mb-2 pl-3">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="leading-relaxed">{children}</li>
                        ),
                        code: ({ children }) => (
                          <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre className="bg-muted p-2 rounded-lg text-xs font-mono overflow-x-auto mb-2">
                            {children}
                          </pre>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-primary/20 pl-3 italic text-muted-foreground mb-2">
                            {children}
                          </blockquote>
                        ),
                      }}
                    >
                      {data.content}
                    </ReactMarkdown>
                  </div>
                </ScrollArea>
              ) : (
                <div className="p-3 text-center">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <FileText className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground mb-2">
                      No guide content available
                    </p>
                    {data.isEditable && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleEditToggle}
                        className="text-xs h-6"
                      >
                        <Edit3 className="w-3 h-3 mr-1" />
                        Add Content
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Collapsed State Preview */}
      {data.isCollapsed && data.content && (
        <div className="p-3 pt-1">
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {data.content.substring(0, 120)}...
          </p>
        </div>
      )}

      {/* Footer Info */}
      {!isExpanded && (
        <div className="px-3 pb-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-2">
              {data.associatedSubtaskId && <span>Linked to subtask</span>}
            </div>
            {data.content && !data.isCollapsed && (
              <span>{Math.ceil(data.content.length / 500)} min read</span>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  );
};

GuideCardNode.displayName = "GuideCardNode";

export default GuideCardNode;
