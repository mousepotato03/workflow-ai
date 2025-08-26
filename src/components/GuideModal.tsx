"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  ExternalLink,
  CheckCircle2,
  Star,
  BookOpen,
  AlertTriangle,
  Lightbulb,
  Target,
  Clock,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GuideSection {
  title: string;
  content: string;
  steps?: string[];
}

interface GuideData {
  id: string;
  toolId: string;
  toolName: string;
  toolUrl?: string;
  toolLogoUrl?: string;
  taskContext: string;
  guide: {
    summary: string;
    sections: GuideSection[];
  };
  sourceUrls: string[];
  confidenceScore: number;
  language: string;
  fromCache: boolean;
  createdAt: string;
  expiresAt: string;
  isSearchFallback?: boolean;
}

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolId: string;
  toolName: string;
  toolUrl?: string;
  toolLogoUrl?: string;
  taskContext: string;
}

interface GenerationProgress {
  stage: string;
  message: string;
  progress: number;
  sourceCount?: number;
  isFallback?: boolean;
}

export function GuideModal({
  isOpen,
  onClose,
  toolId,
  toolName,
  toolUrl,
  toolLogoUrl,
  taskContext,
}: GuideModalProps) {
  const [guideData, setGuideData] = useState<GuideData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateGuide = async () => {
    setIsLoading(true);
    setError(null);
    setProgress(null);
    setGuideData(null);

    try {
      // First, check if cached guide exists
      const cachedResponse = await fetch(
        `/api/tools/${toolId}/guide?taskContext=${encodeURIComponent(
          taskContext
        )}&language=en`
      );

      if (cachedResponse.ok) {
        const cachedGuide = await cachedResponse.json();
        setGuideData(cachedGuide);
        setIsLoading(false);
        return;
      }

      // If no cached guide, generate new one with streaming
      const streamResponse = await fetch(`/api/tools/${toolId}/guide/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskContext,
          language: "en",
        }),
      });

      if (!streamResponse.ok) {
        throw new Error("Failed to request guide generation.");
      }

      const reader = streamResponse.body?.getReader();
      if (!reader) {
        throw new Error("Cannot read stream.");
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
            if (line.trim() === "") continue; // Skip empty lines

            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
              console.log("SSE Event:", currentEvent);
            } else if (line.startsWith("data: ")) {
              try {
                const dataStr = line.slice(6).trim();
                console.log("SSE Data:", dataStr);
                const data = JSON.parse(dataStr);

                if (currentEvent === "progress") {
                  console.log("Progress update:", data);
                  setProgress(data);
                } else if (currentEvent === "complete") {
                  console.log("Complete data:", data);
                  setGuideData(data);
                  setIsLoading(false);
                  setProgress(null);
                  return; // Exit the loop when complete
                } else if (currentEvent === "error") {
                  console.log("Error data:", data);
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
    } catch (err) {
      console.error("Guide generation error:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred."
      );
      setIsLoading(false);
      setProgress(null);
    }
  };

  const handleToolClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("GuideModal handleToolClick called with URL:", toolUrl);

    if (toolUrl && toolUrl.trim()) {
      // URL 형식 검사 및 수정
      let validUrl = toolUrl.trim();
      if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) {
        validUrl = "https://" + validUrl;
      }

      console.log("GuideModal processed URL:", validUrl);

      try {
        // URL 유효성 검사
        new URL(validUrl);
        console.log("GuideModal opening URL:", validUrl);

        // 새 탭에서 사이트 열기
        window.open(validUrl, "_blank", "noopener,noreferrer");
      } catch (error) {
        console.error("GuideModal invalid URL:", toolUrl, error);
        // 사용자에게 오류 알림 (선택사항)
        alert("유효하지 않은 URL입니다: " + toolUrl);
      }
    } else {
      console.warn("GuideModal: No URL provided to handleToolClick");
    }
  };

  const getSectionIcon = (title: string) => {
    const titleLower = title.toLowerCase();
    if (
      titleLower.includes("preparation") ||
      titleLower.includes("setup") ||
      titleLower.includes("getting started")
    )
      return <Target className="w-4 h-4" />;
    if (
      titleLower.includes("step") ||
      titleLower.includes("usage") ||
      titleLower.includes("how to")
    )
      return <CheckCircle2 className="w-4 h-4" />;
    if (
      titleLower.includes("caution") ||
      titleLower.includes("warning") ||
      titleLower.includes("important")
    )
      return <AlertTriangle className="w-4 h-4" />;
    if (
      titleLower.includes("tip") ||
      titleLower.includes("best practices") ||
      titleLower.includes("advanced")
    )
      return <Lightbulb className="w-4 h-4" />;
    if (
      titleLower.includes("result") ||
      titleLower.includes("completion") ||
      titleLower.includes("final")
    )
      return <Star className="w-4 h-4" />;
    return <BookOpen className="w-4 h-4" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {toolLogoUrl ? (
              <img
                src={toolLogoUrl}
                alt={`${toolName} logo`}
                className="w-8 h-8 rounded-lg object-cover border border-border"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
            )}
            <div>
              <span className="text-lg font-semibold">
                {toolName} Usage Guide
              </span>
              <div className="text-sm text-muted-foreground mt-1">
                Detailed guide for {taskContext}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-full">
          {!guideData && !isLoading && !error && (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center">
                <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  Detailed Usage Guide
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Get detailed guidance on how to use {toolName} for{" "}
                  {taskContext} tasks based on the latest information.
                </p>
                <Button onClick={generateGuide} size="lg">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Generate Guide
                </Button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center max-w-md">
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                {progress && (
                  <>
                    <h3 className="text-lg font-semibold mb-2">
                      {progress.message}
                    </h3>
                    <div className="w-full bg-muted rounded-full h-2 mb-4">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress.progress}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {progress.progress}% Complete
                      {progress.sourceCount &&
                        ` • ${progress.sourceCount} references`}
                    </p>
                    {progress.isFallback && (
                      <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-xs flex items-start gap-2 text-left">
                        <AlertTriangle className="w-4 h-4 mt-0.5" />
                        <div>
                          Temporary web search issues detected. Generating guide
                          with limited reference materials.
                        </div>
                      </div>
                    )}
                  </>
                )}
                {!progress && (
                  <p className="text-muted-foreground">Generating guide...</p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center">
                <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Error Occurred</h3>
                <p className="text-muted-foreground mb-6 max-w-md">{error}</p>
                <Button onClick={generateGuide} variant="outline">
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {guideData && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                {(guideData.isSearchFallback || progress?.isFallback) && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5" />
                    <div>
                      There was a temporary issue with web search. The guide was
                      generated with limited reference materials. Please try
                      again later or check official documentation.
                    </div>
                  </div>
                )}
                {/* Header with tool info and confidence */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleToolClick}
                      variant="outline"
                      size="sm"
                      disabled={!toolUrl}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Use Tool
                    </Button>
                    {guideData.fromCache && (
                      <Badge variant="secondary">
                        <Clock className="w-3 h-3 mr-1" />
                        Cached
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Confidence
                    </span>
                    <Badge
                      variant={
                        guideData.confidenceScore > 0.7
                          ? "default"
                          : "secondary"
                      }
                      className="flex items-center gap-1"
                    >
                      <Star className="w-3 h-3" />
                      {Math.round(guideData.confidenceScore * 100)}%
                    </Badge>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-muted rounded-lg p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Summary
                  </h3>
                  <p className="text-sm leading-relaxed">
                    {guideData.guide.summary}
                  </p>
                </div>

                {/* Guide sections */}
                <div className="space-y-4">
                  {guideData.guide.sections.map((section, index) => (
                    <div
                      key={index}
                      className="border border-border rounded-lg p-4"
                    >
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        {getSectionIcon(section.title)}
                        {section.title}
                      </h3>

                      {section.content && (
                        <div className="mb-3">
                          <p className="text-sm leading-relaxed whitespace-pre-line">
                            {section.content}
                          </p>
                        </div>
                      )}

                      {section.steps && section.steps.length > 0 && (
                        <div className="space-y-2">
                          {section.steps.map((step, stepIndex) => (
                            <div key={stepIndex} className="flex gap-3">
                              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs text-primary-foreground font-semibold flex-shrink-0 mt-0.5">
                                {stepIndex + 1}
                              </div>
                              <p className="text-sm leading-relaxed">{step}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Source URLs */}
                {guideData.sourceUrls && guideData.sourceUrls.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" />
                        References
                      </h3>
                      <div className="space-y-2">
                        {guideData.sourceUrls.slice(0, 3).map((url, index) => (
                          <a
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm text-primary hover:underline truncate"
                          >
                            {url}
                          </a>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
