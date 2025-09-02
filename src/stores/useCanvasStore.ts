import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  Connection,
} from "reactflow";
import {
  CanvasNode,
  CanvasEdge,
  CanvasNodeType,
  CanvasState,
  CanvasActions,
  CanvasConfig,
  CanvasUtils,
  MainTaskNodeData,
  SubtaskNodeData,
  GuideCardNodeData,
  SubtaskNodeStatus,
  BaseNodeData,
  CanvasNodeData,
  CanvasGuideGenerationStatus,
} from "@/types/canvas";
import {
  Task,
  useWorkflowStore,
} from "@/features/workflow/hooks/useWorkflowStore";

// History interface for undo/redo functionality - use the one from types
import { CanvasHistoryEntry } from "@/types/canvas";

interface CanvasHistoryState {
  history: CanvasHistoryEntry[];
  historyIndex: number;
  isUndoRedoing: boolean;
}

// Extended state that includes history management
interface ExtendedCanvasState extends CanvasState, CanvasActions {
  // History management
  history: CanvasHistoryEntry[];
  historyIndex: number;
  maxHistorySize: number;
  isUndoRedoing: boolean;

  // Workflow integration
  lastWorkflowSync: Date | null;

  // Canvas configuration
  config: CanvasConfig;

  // Track unsaved changes
  hasUnsavedChanges: boolean;
  lastSavedTimestamp: Date | null;

  // Internal methods
  saveHistoryPoint: (action: string) => void;
  saveCanvas: () => void;
  syncWithWorkflow: () => void;
  exportToWorkflow: () => { goal: string; tasks: Task[] };
  loadCanvas: (data: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => void;
  getNodeById: (id: string) => CanvasNode | undefined;
  getMainTaskNode: () => CanvasNode<MainTaskNodeData> | undefined;
  hasMeaningfulChanges: () => boolean;
}

// Default canvas configuration with 5-level zoom
const DEFAULT_CONFIG: CanvasConfig = {
  showGrid: true,
  showMinimap: true,
  showControls: true,
  nodeSpacing: { x: 200, y: 150 },
  maxZoom: 2.0, // Level 5 (최대 확대)
  minZoom: 0.5, // Level 1 (최대 축소)
  autoSave: false,
  autoSaveInterval: 30000, // 30 seconds
  enableAnimations: true,
  theme: {
    primaryColor: "#6366f1",
    secondaryColor: "#8b5cf6",
    backgroundColor: "#ffffff",
    textColor: "#1f2937",
    borderColor: "#e5e7eb",
  },
};

// Create initial main task node
const createInitialMainTaskNode = (): CanvasNode<MainTaskNodeData> => {
  const nodeId = CanvasUtils.generateNodeId(CanvasNodeType.MAIN_TASK);
  return {
    id: nodeId,
    type: CanvasNodeType.MAIN_TASK,
    position: { x: 250, y: 100 },
    data: {
      label: "Main Task",
      nodeId: nodeId,
      goal: "",
      description: "",
      isEditing: false,
      isLocked: true,
      width: 320,
      height: 120,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    draggable: true,
    selectable: true,
    deletable: false, // 메인 태스크는 삭제 불가
  };
};

// Initial state with default main task node
const INITIAL_STATE = {
  nodes: [createInitialMainTaskNode()],
  edges: [],
  mainTaskNode: createInitialMainTaskNode(),
  selectedNodeIds: [],
  selectedEdgeIds: [],
  isEditing: false,
  zoomLevel: 1,
  viewport: { x: 0, y: 0, zoom: 1.0 }, // Level 3 (기본값, 5단계 중 중간)
  isProcessing: false,
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,
  isUndoRedoing: false,
  config: DEFAULT_CONFIG,
  lastWorkflowSync: null,
  hasUnsavedChanges: false,
  lastSavedTimestamp: null,
};

export const useCanvasStore = create<ExtendedCanvasState>()(
  subscribeWithSelector((set, get) => ({
    ...INITIAL_STATE,

    // Internal helper methods
    saveHistoryPoint: (action: string) => {
      const current = get();
      if (current.isUndoRedoing) return;

      const historyEntry: CanvasHistoryEntry = {
        timestamp: new Date(),
        action,
        state: {
          nodes: [...current.nodes],
          edges: [...current.edges],
        },
      };

      const newHistory = current.history.slice(0, current.historyIndex + 1);
      newHistory.push(historyEntry);

      // Keep only the last maxHistorySize entries
      if (newHistory.length > current.maxHistorySize) {
        newHistory.shift();
      }

      set({
        history: newHistory,
        historyIndex: newHistory.length - 1,
        hasUnsavedChanges: true,
      });
    },

    loadCanvas: (data: { nodes: CanvasNode[]; edges: CanvasEdge[] }) => {
      set({
        nodes: data.nodes,
        edges: data.edges,
        mainTaskNode:
          (data.nodes.find(
            (n) => n.type === CanvasNodeType.MAIN_TASK
          ) as CanvasNode<MainTaskNodeData>) || null,
      });
    },

    getNodeById: (id: string): CanvasNode | undefined => {
      return get().nodes.find((n) => n.id === id);
    },

    getMainTaskNode: (): CanvasNode<MainTaskNodeData> | undefined => {
      return get().nodes.find(
        (n) => n.type === CanvasNodeType.MAIN_TASK
      ) as CanvasNode<MainTaskNodeData>;
    },

    hasMeaningfulChanges: (): boolean => {
      const current = get();

      // If there are any edges, there are meaningful changes
      if (current.edges.length > 0) return true;

      // If there are more than just the main task node
      if (current.nodes.length > 1) return true;

      // Check if main task node has meaningful content
      const mainTask = current.getMainTaskNode();
      if (mainTask && mainTask.data.goal?.trim()) return true;

      return false;
    },

    // Node operations
    addNode: (
      nodeType: CanvasNodeType,
      position?: { x: number; y: number },
      data?: Partial<CanvasNodeData>
    ): string => {
      const current = get();
      const nodeId = CanvasUtils.generateNodeId(nodeType);

      const nodePosition =
        position ||
        CanvasUtils.calculateNodePosition(
          current.nodes,
          current.config.nodeSpacing
        );

      const baseData = CanvasUtils.createDefaultNodeData(nodeType);
      const nodeData = { ...baseData, ...data };

      const newNode: CanvasNode = {
        id: nodeId,
        type: nodeType,
        position: nodePosition,
        data: nodeData,
        draggable: true,
        selectable: true,
        deletable: nodeType !== CanvasNodeType.MAIN_TASK,
      };

      const updatedNodes = [...current.nodes, newNode];
      let updatedMainTaskNode = current.mainTaskNode;

      if (nodeType === CanvasNodeType.MAIN_TASK) {
        updatedMainTaskNode = newNode as CanvasNode<MainTaskNodeData>;
      }

      set({
        nodes: updatedNodes,
        mainTaskNode: updatedMainTaskNode,
        hasUnsavedChanges: true,
      });

      current.saveHistoryPoint(`Add ${nodeType} node`);
      return nodeId;
    },

    updateNode: (nodeId: string, data: Partial<CanvasNodeData>): void => {
      const current = get();
      const updatedNodes = current.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...data,
                updatedAt: new Date(),
              },
            }
          : node
      );

      const updatedMainTaskNode =
        (updatedNodes.find(
          (n) => n.type === CanvasNodeType.MAIN_TASK
        ) as CanvasNode<MainTaskNodeData>) || null;

      set({
        nodes: updatedNodes,
        mainTaskNode: updatedMainTaskNode,
        hasUnsavedChanges: true,
      });

      current.saveHistoryPoint(`Update ${nodeId}`);
    },

    deleteNode: (nodeId: string): void => {
      const current = get();
      const nodeToDelete = current.nodes.find((n) => n.id === nodeId);

      if (!nodeToDelete || nodeToDelete.type === CanvasNodeType.MAIN_TASK) {
        return; // Prevent deletion of main task node
      }

      // Remove connected edges
      const updatedEdges = current.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      );

      const updatedNodes = current.nodes.filter((node) => node.id !== nodeId);

      set({
        nodes: updatedNodes,
        edges: updatedEdges,
        hasUnsavedChanges: true,
      });

      current.saveHistoryPoint(`Delete ${nodeToDelete.type} node`);
    },

    moveNode: (nodeId: string, position: { x: number; y: number }): void => {
      const current = get();
      const updatedNodes = current.nodes.map((node) =>
        node.id === nodeId ? { ...node, position } : node
      );

      set({ nodes: updatedNodes });
    },

    selectNodes: (nodeIds: string[]): void => {
      set({ selectedNodeIds: nodeIds });
    },

    deselectAllNodes: (): void => {
      set({ selectedNodeIds: [], selectedEdgeIds: [] });
    },

    // Edge operations
    addEdge: (connection: Connection, edgeData?: Partial<CanvasEdge>): void => {
      const current = get();
      const edgeId = CanvasUtils.generateEdgeId(
        connection.source!,
        connection.target!
      );

      const newEdge: CanvasEdge = {
        id: edgeId,
        source: connection.source!,
        target: connection.target!,
        type: "smoothstep",
        animated: current.config.enableAnimations,
        ...edgeData,
      };

      const updatedEdges = [...current.edges, newEdge];
      set({
        edges: updatedEdges,
        hasUnsavedChanges: true,
      });

      current.saveHistoryPoint(
        `Add edge from ${connection.source} to ${connection.target}`
      );
    },

    updateEdge: (edgeId: string, data: Partial<CanvasEdge>): void => {
      const current = get();
      const updatedEdges = current.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, ...data } : edge
      );

      set({
        edges: updatedEdges,
        hasUnsavedChanges: true,
      });
      current.saveHistoryPoint(`Update edge ${edgeId}`);
    },

    deleteEdge: (edgeId: string): void => {
      const current = get();
      const updatedEdges = current.edges.filter((edge) => edge.id !== edgeId);

      set({
        edges: updatedEdges,
        hasUnsavedChanges: true,
      });
      current.saveHistoryPoint(`Delete edge ${edgeId}`);
    },

    // Batch operations for React Flow integration
    onNodesChange: (changes: NodeChange[]): void => {
      const current = get();
      const updatedNodes = applyNodeChanges(
        changes,
        current.nodes
      ) as CanvasNode[];

      set({ nodes: updatedNodes });
    },

    onEdgesChange: (changes: EdgeChange[]): void => {
      const current = get();
      const updatedEdges = applyEdgeChanges(
        changes,
        current.edges
      ) as CanvasEdge[];

      set({ edges: updatedEdges });
    },

    // AI integration operations
    generateToolRecommendation: async (nodeId: string): Promise<void> => {
      const current = get();
      const node = current.nodes.find((n) => n.id === nodeId);

      if (!node || node.type !== CanvasNodeType.SUBTASK) return;

      const subtaskData = node.data as SubtaskNodeData;

      if (!subtaskData.taskDescription?.trim()) {
        current.updateNode(nodeId, {
          status: SubtaskNodeStatus.ERROR,
          errorMessage: "Please describe the task first",
          progress: 0,
        });
        return;
      }

      // Update node status to analyzing
      current.updateNode(nodeId, {
        status: SubtaskNodeStatus.ANALYZING,
        progress: 10,
      });

      try {
        set({ isProcessing: true });

        // Call the real smart recommendation API
        current.updateNode(nodeId, {
          progress: 30,
        });

        const response = await fetch("/api/tools/smart-recommend", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            taskName: subtaskData.taskDescription,
            language: "en",
            enableRAG: true,
            enableAdaptive: true,
            fallbackToLegacy: true,
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`API Error (${response.status}): ${errorData}`);
        }

        const result = await response.json();

        current.updateNode(nodeId, {
          progress: 70,
        });

        if (result.success && result.data) {
          const recommendation = result.data;

          // Fetch additional tool details if needed
          let toolDetails = null;
          if (recommendation.toolId) {
            try {
              const toolResponse = await fetch(
                `/api/tools/${recommendation.toolId}`
              );
              if (toolResponse.ok) {
                const toolData = await toolResponse.json();
                toolDetails = {
                  id: recommendation.toolId,
                  name: recommendation.toolName || toolData.name,
                  logoUrl: toolData.logo_url || "",
                  url: toolData.url || "",
                };
              }
            } catch (toolError) {
              // Continue with basic info if tool fetch fails
              console.warn("Failed to fetch tool details:", toolError);
            }
          }

          // Use fallback tool info if detailed fetch failed
          if (!toolDetails && recommendation.toolId) {
            toolDetails = {
              id: recommendation.toolId,
              name: recommendation.toolName || "Unknown Tool",
              logoUrl: "",
              url: "",
            };
          }

          if (toolDetails) {
            // Update node with successful recommendation
            current.updateNode(nodeId, {
              status: SubtaskNodeStatus.RECOMMENDED,
              recommendedTool: toolDetails,
              recommendationReason:
                recommendation.reason ||
                recommendation.recommendationReason ||
                "AI-generated recommendation",
              confidence:
                recommendation.confidenceScore ||
                recommendation.finalScore ||
                1.0,
              hasToolRecommendation: true,
              progress: 100,
            });
          } else {
            throw new Error("No suitable tool found for this task");
          }
        } else {
          throw new Error(
            result.error || "Failed to generate tool recommendation"
          );
        }
      } catch (error) {
        console.error("Tool recommendation failed:", error);
        current.updateNode(nodeId, {
          status: SubtaskNodeStatus.ERROR,
          errorMessage:
            error instanceof Error
              ? error.message.length > 100
                ? error.message.substring(0, 100) + "..."
                : error.message
              : "Failed to generate tool recommendation",
          progress: 0,
        });
      } finally {
        set({ isProcessing: false });
      }
    },

    generateImplementationGuide: async (nodeId: string): Promise<void> => {
      const current = get();
      const node = current.nodes.find((n) => n.id === nodeId);

      if (!node || node.type !== CanvasNodeType.SUBTASK) return;

      const subtaskData = node.data as SubtaskNodeData;

      // Ensure we have a tool recommendation first
      if (!subtaskData.recommendedTool?.id) {
        await current.generateToolRecommendation(nodeId);
        // Get updated node data after recommendation
        const updatedNode = current.getNodeById(nodeId);
        const updatedData = updatedNode?.data as SubtaskNodeData;
        if (!updatedData?.recommendedTool?.id) {
          current.updateNode(nodeId, {
            status: SubtaskNodeStatus.ERROR,
            errorMessage:
              "No tool recommendation available. Please generate one first.",
            progress: 0,
          });
          return;
        }
        // Update local reference
        subtaskData.recommendedTool = updatedData.recommendedTool;
      }

      if (!subtaskData.taskDescription?.trim()) {
        current.updateNode(nodeId, {
          status: SubtaskNodeStatus.ERROR,
          errorMessage: "Task description is required for guide generation",
          progress: 0,
        });
        return;
      }

      // Update node status to generating guide
      current.updateNode(nodeId, {
        status: SubtaskNodeStatus.GENERATING_GUIDE,
        progress: 10,
      });

      try {
        set({ isProcessing: true });

        // Use the real streaming guide generation API
        const response = await fetch(
          `/api/tools/${subtaskData.recommendedTool.id}/guide/stream`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              taskContext: subtaskData.taskDescription,
              language: "en",
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Guide API Error (${response.status}): ${errorText}`);
        }

        // Handle Server-Sent Events stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalGuideData = null;

        if (!reader) {
          throw new Error("No response body available");
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: ") {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.stage) {
                  // Update progress based on streaming events
                  const nodeData = current.getNodeById(nodeId)
                    ?.data as SubtaskNodeData;
                  let progress = nodeData?.progress || 10;

                  switch (data.stage) {
                    case "tool_lookup":
                      progress = 15;
                      break;
                    case "tool_found":
                      progress = 25;
                      break;
                    case "cache_check":
                      progress = 35;
                      break;
                    case "cache_found":
                      progress = 90;
                      break;
                    case "web_search":
                      progress = 45;
                      break;
                    case "search_complete":
                      progress = 60;
                      break;
                    case "guide_generation":
                      progress = 75;
                      break;
                    case "guide_ready":
                      progress = 90;
                      break;
                    case "complete":
                      progress = 100;
                      break;
                  }

                  current.updateNode(nodeId, { progress });
                }
              } catch (parseError) {
                console.warn("Failed to parse SSE data:", parseError);
              }
            } else if (line.startsWith("event: complete")) {
              // Next line should contain the final data
            } else if (line.startsWith("event: error")) {
              // Next line should contain error data
            }
          }
        }

        // The final complete event should be in the last data
        const finalLines = buffer.split("\n");
        for (const line of finalLines) {
          if (line.startsWith("data: ") && line !== "data: ") {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.guide || data.toolName) {
                finalGuideData = data;
                break;
              }
            } catch (parseError) {
              console.warn("Failed to parse final SSE data:", parseError);
            }
          }
        }

        if (!finalGuideData) {
          // Try non-streaming approach as fallback
          const fallbackResponse = await fetch(
            `/api/tools/${subtaskData.recommendedTool.id}/guide`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                taskContext: subtaskData.taskDescription,
                language: "en",
              }),
            }
          );

          if (fallbackResponse.ok) {
            finalGuideData = await fallbackResponse.json();
          } else {
            throw new Error(
              "Failed to generate guide using both streaming and fallback methods"
            );
          }
        }

        if (finalGuideData) {
          // Convert guide data to markdown format
          const markdownGuide = convertGuideDataToMarkdown(
            finalGuideData,
            subtaskData
          );

          // Create a guide card node
          const guidePosition = {
            x: node.position.x + 320,
            y: node.position.y,
          };

          const guideNodeId = current.addNode(
            CanvasNodeType.GUIDE_CARD,
            guidePosition,
            {
              title: `${subtaskData.taskDescription} - Implementation Guide`,
              content: markdownGuide,
              associatedSubtaskId: nodeId,
              tool: subtaskData.recommendedTool,
              generationStatus: {
                status: "completed" as const,
                progress: 100,
                guide: markdownGuide,
              } as CanvasGuideGenerationStatus,
              isCollapsed: false,
              isEditable: true,
              isUserModified: false,
            }
          );

          // Connect the subtask to the guide
          current.addEdge(
            {
              source: nodeId,
              target: guideNodeId,
              sourceHandle: null,
              targetHandle: null,
            },
            {
              type: "smoothstep",
              animated: true,
              isAutoGenerated: true,
              label: "guide",
            }
          );

          // Update subtask node with completion status
          current.updateNode(nodeId, {
            status: SubtaskNodeStatus.GUIDE_GENERATED,
            connectedGuideId: guideNodeId,
            progress: 100,
          });
        } else {
          throw new Error("No guide data received from the API");
        }
      } catch (error) {
        console.error("Guide generation failed:", error);
        current.updateNode(nodeId, {
          status: SubtaskNodeStatus.ERROR,
          errorMessage:
            error instanceof Error
              ? error.message.length > 100
                ? error.message.substring(0, 100) + "..."
                : error.message
              : "Failed to generate implementation guide",
          progress: 0,
        });
      } finally {
        set({ isProcessing: false });
      }
    },

    connectGuideToSubtask: (subtaskId: string, guideId: string): void => {
      const current = get();
      current.addEdge(
        {
          source: subtaskId,
          target: guideId,
          sourceHandle: null,
          targetHandle: null,
        },
        {
          type: "smoothstep",
          animated: true,
          isAutoGenerated: true,
          label: "guide",
        }
      );
    },

    // Canvas operations
    clearCanvas: (): void => {
      const current = get();
      // 메인 태스크 노드를 초기 상태로 리셋하고 나머지는 삭제
      const newMainTaskNode = createInitialMainTaskNode();

      set({
        nodes: [newMainTaskNode],
        edges: [],
        mainTaskNode: newMainTaskNode,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        hasUnsavedChanges: false,
        lastSavedTimestamp: new Date(),
      });

      current.saveHistoryPoint("Clear canvas");
    },

    resetCanvas: (): void => {
      // Reset to initial state completely
      const newMainTaskNode = createInitialMainTaskNode();
      set({
        nodes: [newMainTaskNode],
        edges: [],
        mainTaskNode: newMainTaskNode,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        isEditing: false,
        zoomLevel: 1,
        viewport: { x: 0, y: 0, zoom: 1.0 },
        isProcessing: false,
        hasUnsavedChanges: false,
        lastSavedTimestamp: new Date(),
        // Clear history as well
        history: [],
        historyIndex: -1,
      });
    },

    setViewport: (viewport: { x: number; y: number; zoom?: number }): void => {
      const current = get();
      const newViewport = {
        ...current.viewport,
        ...viewport,
      };

      // Always clamp zoom if provided
      if (viewport.zoom !== undefined) {
        newViewport.zoom = Math.max(
          current.config.minZoom,
          Math.min(current.config.maxZoom, viewport.zoom)
        );
      }

      set({
        viewport: newViewport,
        zoomLevel: newViewport.zoom,
      });
    },

    // History operations
    undo: (): void => {
      const current = get();
      if (current.historyIndex > 0) {
        set({ isUndoRedoing: true });

        const previousState = current.history[current.historyIndex - 1];
        set({
          nodes: [...previousState.state.nodes],
          edges: [...previousState.state.edges],
          mainTaskNode:
            (previousState.state.nodes.find(
              (n) => n.type === CanvasNodeType.MAIN_TASK
            ) as CanvasNode<MainTaskNodeData>) || null,
          historyIndex: current.historyIndex - 1,
          isUndoRedoing: false,
        });
      }
    },

    redo: (): void => {
      const current = get();
      if (current.historyIndex < current.history.length - 1) {
        set({ isUndoRedoing: true });

        const nextState = current.history[current.historyIndex + 1];
        set({
          nodes: [...nextState.state.nodes],
          edges: [...nextState.state.edges],
          mainTaskNode:
            (nextState.state.nodes.find(
              (n) => n.type === CanvasNodeType.MAIN_TASK
            ) as CanvasNode<MainTaskNodeData>) || null,
          historyIndex: current.historyIndex + 1,
          isUndoRedoing: false,
        });
      }
    },

    canUndo: (): boolean => {
      const current = get();
      return current.historyIndex > 0;
    },

    canRedo: (): boolean => {
      const current = get();
      return current.historyIndex < current.history.length - 1;
    },

    saveCanvas: (): void => {
      // Auto-save implementation - could save to localStorage or server
      const current = get();
      if (current.config.autoSave) {
        const canvasData = {
          nodes: current.nodes,
          edges: current.edges,
          viewport: current.viewport,
          config: current.config,
          timestamp: new Date().toISOString(),
        };

        try {
          localStorage.setItem("canvas-state", JSON.stringify(canvasData));
          set({
            hasUnsavedChanges: false,
            lastSavedTimestamp: new Date(),
          });
        } catch (error) {
          console.warn("Failed to save canvas to localStorage:", error);
        }
      }
    },

    // Workflow integration methods
    syncWithWorkflow: (): void => {
      const current = get();
      const workflowStore = useWorkflowStore.getState();

      if (!workflowStore.workflowResult) return;

      // Sync main task
      let mainTaskNode = current.getMainTaskNode();
      if (!mainTaskNode && workflowStore.userGoal) {
        // Create main task node from workflow goal
        const mainTaskNodeId = current.addNode(
          CanvasNodeType.MAIN_TASK,
          { x: 250, y: 100 },
          {
            goal: workflowStore.userGoal,
            description: "",
            isLocked: true,
          }
        );
      } else if (
        mainTaskNode &&
        workflowStore.userGoal !== (mainTaskNode.data as MainTaskNodeData).goal
      ) {
        // Update existing main task node
        current.updateNode(mainTaskNode.id, {
          goal: workflowStore.userGoal || "",
          description: "",
        });
      }

      // Sync tasks to subtask nodes
      workflowStore.workflowResult.tasks.forEach((task, index) => {
        // Find existing node for this task
        const existingNode = current.nodes.find(
          (n) =>
            n.type === CanvasNodeType.SUBTASK &&
            (n.data as SubtaskNodeData).taskId === task.id
        );

        if (existingNode) {
          // Update existing node
          current.updateNode(existingNode.id, {
            taskDescription: task.name,
            recommendedTool: task.recommendedTool,
            recommendationReason: task.recommendationReason,
            confidence: task.confidence,
            hasToolRecommendation: !!task.recommendedTool,
            status: task.recommendedTool
              ? SubtaskNodeStatus.RECOMMENDED
              : SubtaskNodeStatus.IDLE,
          });
        } else {
          // Create new subtask node
          const position = {
            x: 100 + (index % 3) * 250,
            y: 250 + Math.floor(index / 3) * 200,
          };

          current.addNode(CanvasNodeType.SUBTASK, position, {
            taskDescription: task.name,
            taskId: task.id,
            recommendedTool: task.recommendedTool,
            recommendationReason: task.recommendationReason,
            confidence: task.confidence,
            hasToolRecommendation: !!task.recommendedTool,
            status: task.recommendedTool
              ? SubtaskNodeStatus.RECOMMENDED
              : SubtaskNodeStatus.IDLE,
            progress: task.recommendedTool ? 100 : 0,
          });
        }
      });

      set({ lastWorkflowSync: new Date() });
    },

    exportToWorkflow: (): { goal: string; tasks: Task[] } => {
      const current = get();
      const mainTask = current.getMainTaskNode();
      const goal = mainTask ? (mainTask.data as MainTaskNodeData).goal : "";

      const tasks: Task[] = current.nodes
        .filter((n) => n.type === CanvasNodeType.SUBTASK)
        .map((node, index) => {
          const data = node.data as SubtaskNodeData;
          return {
            id: data.taskId || node.id,
            name: data.taskDescription,
            order: index + 1,
            recommendedTool: data.recommendedTool || null,
            recommendationReason: data.recommendationReason || "",
            confidence: data.confidence || 1.0,
            hasToolRecommendation: data.hasToolRecommendation || false,
            usageGuidance: undefined,
          };
        });

      return { goal, tasks };
    },
  }))
);

// Helper function to convert guide data to markdown
function convertGuideDataToMarkdown(
  guideData: any,
  subtaskData: SubtaskNodeData
): string {
  let markdown = `# ${subtaskData.taskDescription} - Implementation Guide\n\n`;

  // Add tool information
  if (subtaskData.recommendedTool) {
    markdown += `## 🛠️ Recommended Tool\n`;
    markdown += `**${subtaskData.recommendedTool.name}**\n`;
    if (subtaskData.recommendedTool.url) {
      markdown += `- Website: [${subtaskData.recommendedTool.url}](${subtaskData.recommendedTool.url})\n`;
    }
    markdown += `\n`;
  }

  // Add task context
  markdown += `## 📋 Task Overview\n${subtaskData.taskDescription}\n\n`;

  // Add guide content
  if (guideData.guide) {
    // Handle structured guide data
    if (typeof guideData.guide === "object") {
      if (guideData.guide.summary) {
        markdown += `## 📝 Summary\n${guideData.guide.summary}\n\n`;
      }

      if (guideData.guide.sections && Array.isArray(guideData.guide.sections)) {
        guideData.guide.sections.forEach((section: any) => {
          markdown += `## ${section.title || "Step"}\n`;

          if (section.content) {
            markdown += `${section.content}\n\n`;
          }

          if (section.steps && Array.isArray(section.steps)) {
            section.steps.forEach((step: string, index: number) => {
              markdown += `${index + 1}. ${step}\n`;
            });
            markdown += "\n";
          }
        });
      }
    } else if (typeof guideData.guide === "string") {
      // Handle simple string guide
      markdown += `## 📖 Implementation Guide\n${guideData.guide}\n\n`;
    }
  }

  // Add source information if available
  if (
    guideData.sourceUrls &&
    Array.isArray(guideData.sourceUrls) &&
    guideData.sourceUrls.length > 0
  ) {
    markdown += `## 📚 Sources\n`;
    guideData.sourceUrls.forEach((url: string, index: number) => {
      markdown += `${index + 1}. [Source ${index + 1}](${url})\n`;
    });
    markdown += "\n";
  }

  // Add confidence and metadata
  const confidence = guideData.confidenceScore || subtaskData.confidence || 0.8;
  const confidencePercentage = Math.round(confidence * 100);

  markdown += `---\n`;
  markdown += `*This guide was generated by AI with ${confidencePercentage}% confidence. `;
  markdown += `Please review and adapt it according to your specific requirements.*\n`;

  return markdown;
}

// History hook for undo/redo functionality
export const useCanvasHistory = () => {
  const canUndo = useCanvasStore((state) => state.canUndo());
  const canRedo = useCanvasStore((state) => state.canRedo());
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const saveHistoryPoint = useCanvasStore((state) => state.saveHistoryPoint);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    saveHistoryPoint,
  };
};

// Subscribe to meaningful changes to update hasUnsavedChanges
useCanvasStore.subscribe(
  (state) => ({
    nodes: state.nodes,
    edges: state.edges,
  }),
  () => {
    const canvasStore = useCanvasStore.getState();
    const hasMeaningfulChanges = canvasStore.hasMeaningfulChanges();

    // Update hasUnsavedChanges based on meaningful changes
    if (hasMeaningfulChanges !== canvasStore.hasUnsavedChanges) {
      useCanvasStore.setState({
        hasUnsavedChanges: hasMeaningfulChanges,
      });
    }
  }
);

// Subscribe to workflow store changes for automatic sync
useCanvasStore.subscribe(
  (state) => state.lastWorkflowSync,
  () => {
    // Auto-sync when workflow store changes
    const workflowStore = useWorkflowStore.getState();
    const canvasStore = useCanvasStore.getState();

    if (
      workflowStore.workflowResult &&
      (!canvasStore.lastWorkflowSync ||
        Date.now() - canvasStore.lastWorkflowSync.getTime() > 5000)
    ) {
      canvasStore.syncWithWorkflow();
    }
  }
);

// Auto-save functionality
if (typeof window !== "undefined") {
  let autoSaveTimeout: NodeJS.Timeout;

  useCanvasStore.subscribe(
    (state) => ({
      nodes: state.nodes,
      edges: state.edges,
      // Remove viewport from auto-save subscription to prevent excessive triggers
    }),
    () => {
      const config = useCanvasStore.getState().config;
      if (config.autoSave) {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
          useCanvasStore.getState().saveCanvas();
        }, config.autoSaveInterval);
      }
    }
  );
}
