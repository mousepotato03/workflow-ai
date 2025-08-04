"use client";

import { useState, useCallback, useRef } from "react";
import { WorkflowRequest, WorkflowResponse } from "@/types/workflow";

export interface StreamEvent {
  type: "progress" | "complete" | "error";
  data: any;
  timestamp: string;
}

export interface ProgressData {
  stage: string;
  progress: number;
  message: string;
  data?: any;
  timestamp: string;
}

export interface StreamState {
  isConnected: boolean;
  isProcessing: boolean;
  progress: number;
  currentStage: string;
  currentMessage: string;
  result: WorkflowResponse | null;
  error: string | null;
  events: StreamEvent[];
}

export interface UseWorkflowStreamReturn {
  streamState: StreamState;
  startWorkflow: (request: WorkflowRequest) => void;
  cancelWorkflow: () => void;
  clearState: () => void;
}

export const useWorkflowStream = (): UseWorkflowStreamReturn => {
  const [streamState, setStreamState] = useState<StreamState>({
    isConnected: false,
    isProcessing: false,
    progress: 0,
    currentStage: "",
    currentMessage: "",
    result: null,
    error: null,
    events: [],
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearState = useCallback(() => {
    setStreamState({
      isConnected: false,
      isProcessing: false,
      progress: 0,
      currentStage: "",
      currentMessage: "",
      result: null,
      error: null,
      events: [],
    });
  }, []);

  const cancelWorkflow = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setStreamState((prev) => ({
      ...prev,
      isConnected: false,
      isProcessing: false,
    }));
  }, []);

  const startWorkflow = useCallback(
    async (request: WorkflowRequest) => {
      // Cancel any existing workflow
      cancelWorkflow();
      clearState();

      // Create abort controller for fetch request
      abortControllerRef.current = new AbortController();

      try {
        setStreamState((prev) => ({
          ...prev,
          isProcessing: true,
          currentStage: "connecting",
          currentMessage: "서버에 연결 중...",
          progress: 0,
        }));

        // Send POST request to start streaming workflow
        const response = await fetch("/api/workflow/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Check if response supports streaming
        if (!response.body) {
          throw new Error("Response body is not available for streaming");
        }

        // Create EventSource-like functionality using fetch stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        setStreamState((prev) => ({
          ...prev,
          isConnected: true,
          currentMessage: "연결 성공! 처리 시작...",
        }));

        try {
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            // Decode the chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });

            // Process complete messages in buffer
            const messages = buffer.split("\n\n");
            buffer = messages.pop() || ""; // Keep incomplete message in buffer

            for (const message of messages) {
              if (message.trim() === "") continue;

              try {
                // Parse Server-Sent Events format
                const lines = message.split("\n");
                let eventType = "message";
                let eventData = "";

                for (const line of lines) {
                  if (line.startsWith("event: ")) {
                    eventType = line.substring(7);
                  } else if (line.startsWith("data: ")) {
                    eventData = line.substring(6);
                  }
                }

                if (eventData) {
                  const data = JSON.parse(eventData);
                  const event: StreamEvent = {
                    type: eventType as "progress" | "complete" | "error",
                    data,
                    timestamp: data.timestamp || new Date().toISOString(),
                  };

                  setStreamState((prev) => ({
                    ...prev,
                    events: [...prev.events, event],
                  }));

                  // Handle different event types
                  switch (eventType) {
                    case "progress":
                      const progressData = data as ProgressData;
                      setStreamState((prev) => ({
                        ...prev,
                        progress: progressData.progress,
                        currentStage: progressData.stage,
                        currentMessage: progressData.message,
                      }));
                      break;

                    case "complete":
                      setStreamState((prev) => ({
                        ...prev,
                        result: data as WorkflowResponse,
                        isProcessing: false,
                        progress: 100,
                        currentMessage: "완료!",
                      }));
                      break;

                    case "error":
                      setStreamState((prev) => ({
                        ...prev,
                        error: data.error || "Unknown error occurred",
                        isProcessing: false,
                        currentMessage: "오류 발생",
                      }));
                      break;
                  }
                }
              } catch (parseError) {
                console.warn(
                  "Failed to parse SSE message:",
                  parseError,
                  message
                );
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // Request was cancelled
          setStreamState((prev) => ({
            ...prev,
            isProcessing: false,
            currentMessage: "요청이 취소되었습니다.",
          }));
        } else {
          setStreamState((prev) => ({
            ...prev,
            error: error instanceof Error ? error.message : "Connection failed",
            isProcessing: false,
            isConnected: false,
            currentMessage: "연결 실패",
          }));
        }
      } finally {
        setStreamState((prev) => ({
          ...prev,
          isConnected: false,
        }));

        abortControllerRef.current = null;
      }
    },
    [cancelWorkflow, clearState]
  );

  return {
    streamState,
    startWorkflow,
    cancelWorkflow,
    clearState,
  };
};
