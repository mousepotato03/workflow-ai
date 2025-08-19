import { create } from "zustand";
import { WorkflowResponse } from "@/types/workflow";

interface Task {
  id: string;
  name: string;
  order: number;
  recommendedTool: {
    id: string;
    name: string;
    logoUrl: string;
    url: string;
  } | null;
  recommendationReason: string;
  usageGuidance?: string;
  confidence: number;
  hasToolRecommendation?: boolean; // Track if tool recommendation has been generated
}

interface TaskWithRequiredFields extends Task {
  hasToolRecommendation: boolean;
}

interface GuideGenerationStatus {
  status: "pending" | "generating" | "completed" | "error";
  progress: number;
  guide?: string;
  error?: string;
}

interface WorkflowState {
  workflowResult: WorkflowResponse | null;
  isLoading: boolean;
  userGoal: string | null;
  selectedTask: string | null;
  isGeneratingGuides: boolean;
  generatedGuides: Map<string, GuideGenerationStatus>;
  resetVersion: number;
  setWorkflowResult: (result: WorkflowResponse | null) => void;
  setIsLoading: (loading: boolean) => void;
  setUserGoal: (goal: string | null) => void;
  setSelectedTask: (taskId: string | null) => void;
  setIsGeneratingGuides: (isGenerating: boolean) => void;
  setGuideStatus: (taskId: string, status: GuideGenerationStatus) => void;
  clearWorkflow: () => void;
  triggerReset: () => void;
  addTask: (name: string) => string;
  updateTask: (taskId: string, name: string) => void;
  deleteTask: (taskId: string) => void;
  addToolRecommendation: (
    taskId: string,
    tool: { id: string; name: string; logoUrl: string; url: string },
    reason: string,
    confidence: number
  ) => void;
  generateGuides: () => Promise<void>;
  retryGuideGeneration: (taskId: string) => Promise<void>;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflowResult: null,
  isLoading: false,
  userGoal: null,
  selectedTask: null,
  isGeneratingGuides: false,
  generatedGuides: new Map(),
  resetVersion: 0,
  setWorkflowResult: (result) => set({ workflowResult: result }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setUserGoal: (goal) => set({ userGoal: goal }),
  setSelectedTask: (taskId) => set({ selectedTask: taskId }),
  setIsGeneratingGuides: (isGenerating) =>
    set({ isGeneratingGuides: isGenerating }),
  setGuideStatus: (taskId, status) => {
    const { generatedGuides } = get();
    const newGuides = new Map(generatedGuides);
    newGuides.set(taskId, status);
    set({ generatedGuides: newGuides });
  },
  clearWorkflow: () =>
    set({
      workflowResult: null,
      isLoading: false,
      userGoal: null,
      selectedTask: null,
      isGeneratingGuides: false,
      generatedGuides: new Map(),
    }),

  triggerReset: () => {
    const current = get();
    set({
      workflowResult: null,
      isLoading: false,
      userGoal: null,
      selectedTask: null,
      isGeneratingGuides: false,
      generatedGuides: new Map(),
      resetVersion: current.resetVersion + 1,
    });
  },

  addTask: (name: string) => {
    const { workflowResult } = get();
    if (!workflowResult) return "";

    const newTask: TaskWithRequiredFields = {
      id: crypto.randomUUID(),
      name,
      order: workflowResult.tasks.length + 1,
      recommendedTool: null,
      recommendationReason: "사용자가 추가한 작업 - 도구 추천 없음",
      confidence: 1.0,
      hasToolRecommendation: false,
    };

    const updatedTasks = [...workflowResult.tasks, newTask];
    set({
      workflowResult: {
        ...workflowResult,
        tasks: updatedTasks,
      },
    });

    return newTask.id;
  },

  updateTask: (taskId: string, name: string) => {
    const { workflowResult } = get();
    if (!workflowResult) return;

    const updatedTasks = workflowResult.tasks.map((task) =>
      task.id === taskId ? { ...task, name } : task
    );

    console.log("Updating task:", taskId, "with name:", name);
    console.log("Updated tasks:", updatedTasks);

    set({
      workflowResult: {
        ...workflowResult,
        tasks: updatedTasks,
      },
    });
  },

  deleteTask: (taskId: string) => {
    const { workflowResult } = get();
    if (!workflowResult) return;

    const filteredTasks = workflowResult.tasks.filter(
      (task) => task.id !== taskId
    );

    // Reorder tasks after deletion
    const reorderedTasks = filteredTasks.map((task, index) => ({
      ...task,
      order: index + 1,
    }));

    set({
      workflowResult: {
        ...workflowResult,
        tasks: reorderedTasks,
      },
    });
  },

  addToolRecommendation: (
    taskId: string,
    tool: { id: string; name: string; logoUrl: string; url: string },
    reason: string,
    confidence: number
  ) => {
    const { workflowResult } = get();
    if (!workflowResult) return;

    const updatedTasks = workflowResult.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            recommendedTool: tool,
            recommendationReason: reason,
            confidence: confidence,
            hasToolRecommendation: true,
          }
        : task
    );

    set({
      workflowResult: {
        ...workflowResult,
        tasks: updatedTasks,
      },
    });
  },

  generateGuides: async () => {
    const { workflowResult, setIsGeneratingGuides, setGuideStatus } = get();
    if (!workflowResult || !workflowResult.tasks.length) return;

    setIsGeneratingGuides(true);

    try {
      // Initialize all tasks as pending
      for (const task of workflowResult.tasks) {
        setGuideStatus(task.id, {
          status: "pending",
          progress: 0,
        });
      }

      // Generate guides sequentially for each task
      for (let task of workflowResult.tasks) {
        // Type assertion to ensure hasToolRecommendation is defined
        const taskWithFlags = task as TaskWithRequiredFields;

        // If no tool recommendation exists, we need to generate one first
        if (!task.recommendedTool?.id && !taskWithFlags.hasToolRecommendation) {
          setGuideStatus(task.id, {
            status: "generating",
            progress: 5,
          });

          try {
            // Generate tool recommendation via server API to avoid client env access
            const recResponse = await fetch("/api/tools/recommend", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                taskName: task.name,
                language: "ko",
              }),
            });

            if (!recResponse.ok) {
              throw new Error(`추천 API 오류: ${await recResponse.text()}`);
            }

            const recommendation = await recResponse.json();

            if (recommendation.toolId && recommendation.toolName) {
              // Fetch tool details from database to get URL and logo
              let toolDetails = {
                id: recommendation.toolId,
                name: recommendation.toolName,
                logoUrl: "",
                url: "",
              };

              try {
                const toolResponse = await fetch(
                  `/api/tools/${recommendation.toolId}`
                );
                if (toolResponse.ok) {
                  const toolData = await toolResponse.json();
                  // Validate the response structure
                  if (toolData && typeof toolData === "object") {
                    toolDetails = {
                      id: recommendation.toolId,
                      name: recommendation.toolName,
                      logoUrl:
                        typeof toolData.logo_url === "string"
                          ? toolData.logo_url
                          : "",
                      url: typeof toolData.url === "string" ? toolData.url : "",
                    };
                  }
                } else {
                  console.warn(
                    `Tool API returned ${toolResponse.status}:`,
                    await toolResponse.text()
                  );
                }
              } catch (error) {
                console.warn(
                  "Failed to fetch tool details:",
                  error instanceof Error ? error.message : String(error)
                );
                // Continue with basic tool info
              }

              // Add tool recommendation to the task
              const { addToolRecommendation } = get();
              addToolRecommendation(
                task.id,
                toolDetails,
                recommendation.reason,
                recommendation.confidenceScore
              );

              // Update progress
              setGuideStatus(task.id, {
                status: "generating",
                progress: 15,
              });

              // Get the updated task with tool recommendation
              const updatedWorkflow = get().workflowResult;
              const updatedTask = updatedWorkflow?.tasks.find(
                (t) => t.id === task.id
              );

              if (updatedTask?.recommendedTool?.id) {
                task = updatedTask; // Update the task reference for guide generation
              } else {
                console.error(
                  "Failed to retrieve updated task with tool recommendation"
                );
                setGuideStatus(task.id, {
                  status: "error",
                  progress: 0,
                  error: "도구 추천 후 작업을 업데이트하는데 실패했습니다.",
                });
                continue;
              }
            } else {
              // No tool found, set error status
              setGuideStatus(task.id, {
                status: "error",
                progress: 0,
                error:
                  "이 작업에 적합한 도구를 찾을 수 없습니다. 수동 접근을 권장합니다.",
              });
              continue;
            }
          } catch (error) {
            console.error(
              "Tool recommendation failed for task:",
              task.id,
              error
            );
            setGuideStatus(task.id, {
              status: "error",
              progress: 0,
              error: "도구 추천 과정에서 오류가 발생했습니다.",
            });
            continue;
          }
        }

        if (!task.recommendedTool?.id) {
          setGuideStatus(task.id, {
            status: "error",
            progress: 0,
            error: "추천된 도구가 없습니다.",
          });
          continue;
        }

        setGuideStatus(task.id, {
          status: "generating",
          progress: 10,
        });

        try {
          // Try to get cached guide first
          const cachedResponse = await fetch(
            `/api/tools/${
              task.recommendedTool.id
            }/guide?taskContext=${encodeURIComponent(task.name)}&language=ko`
          );

          if (cachedResponse.ok) {
            const cachedGuide = await cachedResponse.json();
            const markdownGuide = convertStructuredGuideToMarkdown(
              cachedGuide,
              task
            );

            setGuideStatus(task.id, {
              status: "completed",
              progress: 100,
              guide: markdownGuide,
            });
            continue;
          }

          // Generate new guide if no cache
          const response = await fetch(
            `/api/tools/${task.recommendedTool.id}/guide`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                taskContext: task.name,
                language: "ko",
              }),
            }
          );

          if (!response.ok) {
            throw new Error("가이드 생성 요청에 실패했습니다.");
          }

          setGuideStatus(task.id, {
            status: "generating",
            progress: 50,
          });

          const guideData = await response.json();
          const markdownGuide = convertStructuredGuideToMarkdown(
            guideData,
            task
          );

          setGuideStatus(task.id, {
            status: "completed",
            progress: 100,
            guide: markdownGuide,
          });

          // Add delay between requests to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error("Guide generation error for task:", task.id, error);
          setGuideStatus(task.id, {
            status: "error",
            progress: 0,
            error:
              error instanceof Error
                ? error.message
                : "알 수 없는 오류가 발생했습니다.",
          });
        }
      }
    } finally {
      setIsGeneratingGuides(false);
    }
  },

  retryGuideGeneration: async (taskId: string) => {
    const { workflowResult, setGuideStatus } = get();
    if (!workflowResult) return;

    const task = workflowResult.tasks.find((t) => t.id === taskId);
    if (!task || !task.recommendedTool?.id) return;

    setGuideStatus(taskId, {
      status: "generating",
      progress: 10,
    });

    try {
      const response = await fetch(
        `/api/tools/${task.recommendedTool.id}/guide`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            taskContext: task.name,
            language: "ko",
            forceRefresh: true, // Force new generation
          }),
        }
      );

      if (!response.ok) {
        throw new Error("가이드 생성 요청에 실패했습니다.");
      }

      setGuideStatus(taskId, {
        status: "generating",
        progress: 50,
      });

      const guideData = await response.json();
      const markdownGuide = convertStructuredGuideToMarkdown(guideData, task);

      setGuideStatus(taskId, {
        status: "completed",
        progress: 100,
        guide: markdownGuide,
      });
    } catch (error) {
      console.error("Guide retry error for task:", taskId, error);
      setGuideStatus(taskId, {
        status: "error",
        progress: 0,
        error:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.",
      });
    }
  },
}));

// Helper function to convert structured guide to markdown
function convertStructuredGuideToMarkdown(guideData: any, task: Task): string {
  let markdown = `# ${task.name} - 상세 실행 가이드\n\n`;

  // Add task information
  markdown += `## 📋 작업 개요\n${task.name}\n\n`;

  // Add tool information
  if (task.recommendedTool) {
    markdown += `## 🛠️ 추천 도구\n`;
    markdown += `- **${task.recommendedTool.name}**\n`;
    if (task.recommendedTool.url) {
      markdown += `  - 링크: ${task.recommendedTool.url}\n`;
    }
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
}
