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
        )}&language=ko`
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
          language: "ko",
        }),
      });

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
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      );
      setIsLoading(false);
      setProgress(null);
    }
  };

  const handleToolClick = () => {
    if (toolUrl) {
      window.open(toolUrl, "_blank", "noopener,noreferrer");
    }
  };

  const getSectionIcon = (title: string) => {
    const titleLower = title.toLowerCase();
    if (titleLower.includes("준비") || titleLower.includes("시작"))
      return <Target className="w-4 h-4" />;
    if (titleLower.includes("단계") || titleLower.includes("사용법"))
      return <CheckCircle2 className="w-4 h-4" />;
    if (titleLower.includes("주의") || titleLower.includes("경고"))
      return <AlertTriangle className="w-4 h-4" />;
    if (titleLower.includes("팁") || titleLower.includes("활용"))
      return <Lightbulb className="w-4 h-4" />;
    if (titleLower.includes("결과") || titleLower.includes("완료"))
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
                {toolName} 사용 가이드
              </span>
              <div className="text-sm text-muted-foreground mt-1">
                {taskContext} 작업을 위한 상세 가이드
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-full">
          {!guideData && !isLoading && !error && (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center">
                <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">상세 사용 가이드</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  {toolName}을 사용하여 {taskContext} 작업을 수행하는 방법을
                  최신 정보를 바탕으로 상세하게 안내해드립니다.
                </p>
                <Button onClick={generateGuide} size="lg">
                  <BookOpen className="w-4 h-4 mr-2" />
                  가이드 생성하기
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
                      {progress.progress}% 완료
                      {progress.sourceCount &&
                        ` • ${progress.sourceCount}개 참고자료`}
                    </p>
                    {progress.isFallback && (
                      <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-xs flex items-start gap-2 text-left">
                        <AlertTriangle className="w-4 h-4 mt-0.5" />
                        <div>
                          웹 검색에 일시적인 문제가 감지되어 제한된 참고 자료로
                          가이드를 생성 중입니다.
                        </div>
                      </div>
                    )}
                  </>
                )}
                {!progress && (
                  <p className="text-muted-foreground">
                    가이드를 생성하고 있습니다...
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center">
                <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">오류 발생</h3>
                <p className="text-muted-foreground mb-6 max-w-md">{error}</p>
                <Button onClick={generateGuide} variant="outline">
                  다시 시도
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
                      최신 웹 검색에 일시적인 문제가 있어 제한된 참고 자료로
                      가이드를 생성했습니다. 나중에 다시 시도하거나 공식 문서를
                      함께 확인해주세요.
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
                      도구 사용하기
                    </Button>
                    {guideData.fromCache && (
                      <Badge variant="secondary">
                        <Clock className="w-3 h-3 mr-1" />
                        캐시됨
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      신뢰도
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
                    요약
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
                        참고 자료
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
