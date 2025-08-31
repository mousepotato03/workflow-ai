"use client";

import React, { useCallback, useMemo, useEffect } from "react";
import ReactFlow, {
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Connection,
  NodeTypes,
  ConnectionMode,
  BackgroundVariant,
  useReactFlow,
  Viewport,
  Edge,
  OnMove,
} from "reactflow";
import "reactflow/dist/style.css";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import {
  Plus,
  Target,
  Square,
  Diamond,
  FileText,
  BookOpen,
  RotateCcw,
  Sparkles,
  Save,
  Download,
  Upload,
  RefreshCw,
  Undo,
  Redo,
} from "lucide-react";

import {
  CanvasNodeType,
  CanvasNode,
  CanvasEdge,
  MainTaskNodeData,
  SubtaskNodeData,
  GuideCardNodeData,
  ShapeNodeData,
  TextNodeData,
  CanvasUtils,
  SubtaskNodeStatus,
} from "@/types/canvas";

// Import the new store and utilities
import { useCanvasStore, useCanvasHistory } from "@/stores/useCanvasStore";
import { useWorkflowStore } from "@/features/workflow/hooks/useWorkflowStore";
import {
  autoLayoutNodes,
  smartLayout,
  createWorkflowConnections,
  isConnectionValid,
  saveCanvasToStorage,
  loadCanvasFromStorage,
  exportCanvasAsFile,
  importCanvasFromFile,
} from "@/lib/canvas";

// Import custom node components
import { MainTaskNode } from "@/components/canvas/nodes/MainTaskNode";
import { SubtaskNode } from "@/components/canvas/nodes/SubtaskNode";
import { GuideCardNode } from "@/components/canvas/nodes/GuideCardNode";

// Shape node components (keeping these simple for now)
const ShapeNodeComponent = ({ data }: { data: ShapeNodeData }) => {
  return (
    <div
      className="border rounded-lg p-4 min-w-[120px] min-h-[80px] flex items-center justify-center"
      style={{
        backgroundColor: data.backgroundColor || "#ffffff",
        borderColor: data.borderColor || "#e5e7eb",
        color: data.textColor || "#374151",
      }}
    >
      <span className="text-sm font-medium">{data.label}</span>
    </div>
  );
};

const DiamondNodeComponent = ({ data }: { data: ShapeNodeData }) => {
  return (
    <div
      className="border rotate-45 w-20 h-20 flex items-center justify-center"
      style={{
        backgroundColor: data.backgroundColor || "#ffffff",
        borderColor: data.borderColor || "#e5e7eb",
      }}
    >
      <span
        className="text-xs font-medium -rotate-45"
        style={{ color: data.textColor || "#374151" }}
      >
        {data.label}
      </span>
    </div>
  );
};

const TextNodeComponent = ({ data }: { data: TextNodeData }) => {
  return (
    <div className="bg-transparent p-2 min-w-[100px]">
      <span
        className="text-sm"
        style={{
          fontSize: data.fontSize || 14,
          fontWeight: data.fontWeight || "normal",
          textAlign: data.textAlign || "left",
          color: data.color || "#374151",
          display: "block",
        }}
      >
        {data.text || "Text"}
      </span>
    </div>
  );
};

// Node wrapper components that inject callbacks per node

interface CanvasToolbarProps {
  onAddNode: (nodeType: CanvasNodeType) => void;
  onClearCanvas: () => void;
  onSaveCanvas: () => void;
  onExportCanvas: () => void;
  onImportCanvas: () => void;
  onSyncWorkflow: () => void;
  onAutoLayout: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  onAddNode,
  onClearCanvas,
  onSaveCanvas,
  onExportCanvas,
  onImportCanvas,
  onSyncWorkflow,
  onAutoLayout,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  return (
    <div className="w-full bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-slate-800 dark:to-slate-700 border-b border-teal-200/50 dark:border-slate-600 shadow-sm p-3 relative z-10">
      <div className="flex items-center justify-between">
        {/* Left: Node Types */}
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddNode(CanvasNodeType.SUBTASK)}
            className="text-xs px-3 py-1 h-8 hover:bg-cyan-100 hover:border-cyan-300 dark:hover:bg-cyan-900/30"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            Subtask
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddNode(CanvasNodeType.GUIDE_CARD)}
            className="text-xs px-3 py-1 h-8 hover:bg-emerald-100 hover:border-emerald-300 dark:hover:bg-emerald-900/30"
          >
            <BookOpen className="w-3 h-3 mr-1" />
            Guide
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddNode(CanvasNodeType.RECTANGLE)}
            className="text-xs px-3 py-1 h-8"
          >
            <Square className="w-3 h-3 mr-1" />
            Rectangle
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddNode(CanvasNodeType.DIAMOND)}
            className="text-xs px-3 py-1 h-8"
          >
            <Diamond className="w-3 h-3 mr-1" />
            Diamond
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddNode(CanvasNodeType.TEXT)}
            className="text-xs px-3 py-1 h-8"
          >
            <FileText className="w-3 h-3 mr-1" />
            Text
          </Button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onUndo}
            disabled={!canUndo}
            className="text-xs px-2 py-1 h-8"
          >
            <Undo className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onRedo}
            disabled={!canRedo}
            className="text-xs px-2 py-1 h-8"
          >
            <Redo className="w-3 h-3" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <Button
            size="sm"
            variant="outline"
            onClick={onSyncWorkflow}
            className="text-xs px-3 py-1 h-8 hover:bg-teal-100 hover:border-teal-300 dark:hover:bg-teal-900/30"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Sync
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onAutoLayout}
            className="text-xs px-3 py-1 h-8 hover:bg-teal-100 hover:border-teal-300 dark:hover:bg-teal-900/30"
          >
            <Target className="w-3 h-3 mr-1" />
            Layout
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onSaveCanvas}
            className="text-xs px-3 py-1 h-8 hover:bg-teal-100 hover:border-teal-300 dark:hover:bg-teal-900/30"
          >
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onExportCanvas}
            className="text-xs px-2 py-1 h-8"
          >
            <Download className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onImportCanvas}
            className="text-xs px-2 py-1 h-8"
          >
            <Upload className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onClearCanvas}
            className="text-xs px-3 py-1 h-8"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
};

const WorkflowCanvasContent: React.FC = () => {
  const { fitView } = useReactFlow();

  // Canvas store
  const {
    nodes,
    edges,
    viewport,
    config,
    addNode,
    updateNode,
    deleteNode,
    onNodesChange,
    onEdgesChange,
    addEdge,
    clearCanvas,
    saveCanvas,
    generateToolRecommendation,
    generateImplementationGuide,
    syncWithWorkflow,
    exportToWorkflow,
    setViewport,
  } = useCanvasStore();

  // History for undo/redo
  const { canUndo, canRedo, undo, redo } = useCanvasHistory();

  // Workflow store for integration
  const workflowStore = useWorkflowStore();

  // Connection handler with validation
  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);

      if (sourceNode && targetNode) {
        const validation = isConnectionValid(sourceNode, targetNode, edges);
        if (validation.isValid) {
          addEdge(params);
        }
      }
    },
    [nodes, edges, addEdge]
  );

  // Initialize canvas - 메인 태스크 노드가 이미 초기 상태에 포함되어 있음
  useEffect(() => {
    // 초기 상태에서 메인 태스크 노드가 이미 존재하므로 별도 초기화 불필요
    // 필요시 여기서 추가 초기화 로직을 수행할 수 있음
  }, []);

  // Auto-sync with workflow store when it changes
  useEffect(() => {
    if (workflowStore.workflowResult) {
      syncWithWorkflow();
    }
  }, [workflowStore.workflowResult, syncWithWorkflow]);

  // Toolbar action handlers
  const handleAddNode = useCallback(
    (nodeType: CanvasNodeType) => {
      const nodeId = addNode(nodeType);

      return nodeId;
    },
    [addNode]
  );

  const handleClearCanvas = useCallback(() => {
    clearCanvas();
  }, [clearCanvas]);

  const handleSaveCanvas = useCallback(() => {
    saveCanvas();
    const success = saveCanvasToStorage(nodes, edges, viewport, config);
  }, [saveCanvas, nodes, edges, viewport, config]);

  const handleExportCanvas = useCallback(() => {
    exportCanvasAsFile(nodes, edges, viewport, config);
  }, [nodes, edges, viewport, config]);

  const handleImportCanvas = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const imported = await importCanvasFromFile(file);
          if (imported) {
            // Load imported canvas data
            useCanvasStore.getState().loadCanvas({
              nodes: imported.nodes,
              edges: imported.edges,
            });
          } else {
          }
        } catch (error) {}
      }
    };
    input.click();
  }, []);

  const handleSyncWorkflow = useCallback(() => {
    syncWithWorkflow();
    exportToWorkflow();
  }, [syncWithWorkflow, exportToWorkflow]);

  const handleAutoLayout = useCallback(() => {
    // Use the existing smartLayout function from the layout utility
    // Convert edges to the format expected by smartLayout
    const simpleEdges = edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
    }));

    const layoutedNodes = smartLayout(nodes, simpleEdges);

    // Apply the new positions by updating each node
    layoutedNodes.forEach((node) => {
      const originalNode = nodes.find((n) => n.id === node.id);
      if (
        originalNode &&
        (node.position.x !== originalNode.position.x ||
          node.position.y !== originalNode.position.y)
      ) {
        updateNode(node.id, { position: node.position } as any);
      }
    });

    // Fit view to show all nodes
    setTimeout(() => fitView({ duration: 800 }), 100);
  }, [nodes, edges, updateNode, fitView]);

  // AI integration handlers
  const handleGenerateRecommendation = useCallback(
    async (nodeId: string) => {
      try {
        await generateToolRecommendation(nodeId);
      } catch (error) {}
    },
    [generateToolRecommendation]
  );

  const handleEditTool = useCallback((nodeId: string) => {
    // TODO: Open tool selection modal
    console.log("Edit tool for node:", nodeId);
  }, []);

  const handleGenerateGuide = useCallback(
    async (nodeId: string) => {
      try {
        await generateImplementationGuide(nodeId);
      } catch (error) {}
    },
    [generateImplementationGuide]
  );

  // Create node wrapper components with store integration
  const MainTaskNodeWrapper = useCallback(
    (props: any) => (
      <MainTaskNode
        {...props}
        onGoalUpdate={(goal: string) => updateNode(props.id, { goal })}
        onEditToggle={(isEditing: boolean) =>
          updateNode(props.id, { isEditing })
        }
      />
    ),
    [updateNode]
  );

  const SubtaskNodeWrapper = useCallback(
    (props: any) => (
      <SubtaskNode
        {...props}
        onTaskUpdate={(taskDescription: string) =>
          updateNode(props.id, { taskDescription })
        }
        onGenerateRecommendation={() => handleGenerateRecommendation(props.id)}
        onEditTool={() => handleEditTool(props.id)}
        onGenerateGuide={() => handleGenerateGuide(props.id)}
      />
    ),
    [
      updateNode,
      handleGenerateRecommendation,
      handleEditTool,
      handleGenerateGuide,
    ]
  );

  const GuideCardNodeWrapper = useCallback(
    (props: any) => (
      <GuideCardNode
        {...props}
        onContentUpdate={(content: string) =>
          updateNode(props.id, { content, isUserModified: true })
        }
        onCollapseToggle={(isCollapsed: boolean) =>
          updateNode(props.id, { isCollapsed })
        }
        onEditContent={(content: string) =>
          updateNode(props.id, { content, isUserModified: true })
        }
      />
    ),
    [updateNode]
  );

  // Node types mapping
  const nodeTypes = useMemo(
    () => ({
      [CanvasNodeType.MAIN_TASK]: MainTaskNodeWrapper,
      [CanvasNodeType.SUBTASK]: SubtaskNodeWrapper,
      [CanvasNodeType.GUIDE_CARD]: GuideCardNodeWrapper,
      [CanvasNodeType.RECTANGLE]: ShapeNodeComponent,
      [CanvasNodeType.DIAMOND]: DiamondNodeComponent,
      [CanvasNodeType.TEXT]: TextNodeComponent,
    }),
    [MainTaskNodeWrapper, SubtaskNodeWrapper, GuideCardNodeWrapper]
  );

  // Viewport change handler
  const onViewportChange: OnMove = useCallback(
    (event, viewport) => {
      setViewport(viewport);
    },
    [setViewport]
  );

  return (
    <div className="w-full h-full bg-gradient-to-br from-teal-50 via-cyan-50 to-slate-100 dark:from-slate-900 dark:via-teal-900 dark:to-cyan-900 relative">
      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges as Edge[]}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeDoubleClick={(event, node) => {
          // Handle node double-click for editing
          if (
            node.type === CanvasNodeType.MAIN_TASK ||
            node.type === CanvasNodeType.SUBTASK
          ) {
            updateNode(node.id, { isEditing: true });
          }
        }}
        onMove={onViewportChange}
        connectionMode={ConnectionMode.Loose}
        defaultViewport={viewport}
        fitView={!viewport.x && !viewport.y}
        fitViewOptions={{
          padding: 0.1,
          minZoom: config.minZoom,
          maxZoom: config.maxZoom,
        }}
        minZoom={config.minZoom}
        maxZoom={config.maxZoom}
      >
        {/* Grid Background */}
        <Background
          variant={
            config.showGrid ? BackgroundVariant.Dots : BackgroundVariant.Lines
          }
          gap={24}
          size={1}
          color="rgba(20, 184, 166, 0.2)"
        />

        {/* Controls */}
        {config.showControls && (
          <Controls
            position="bottom-right"
            showZoom={true}
            showFitView={true}
            showInteractive={true}
          />
        )}

        {/* MiniMap */}
        {config.showMinimap && (
          <MiniMap
            position="bottom-left"
            maskColor="rgba(20, 184, 166, 0.1)" // teal-500 with opacity
            nodeStrokeColor="#14b8a6" // teal-500
            nodeStrokeWidth={1.5}
            nodeColor={(node) => {
              switch (node.type) {
                case CanvasNodeType.MAIN_TASK:
                  return "#14b8a6"; // teal-500
                case CanvasNodeType.SUBTASK:
                  return "#06b6d4"; // cyan-500
                case CanvasNodeType.GUIDE_CARD:
                  return "#10b981"; // emerald-500
                default:
                  return "#64748b"; // slate-500
              }
            }}
          />
        )}
      </ReactFlow>
    </div>
  );
};

export const WorkflowCanvas: React.FC = () => {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <ReactFlowProvider>
        <WorkflowCanvasWithToolbar />
      </ReactFlowProvider>
    </div>
  );
};

const WorkflowCanvasWithToolbar: React.FC = () => {
  const [nodes, edges] = useCanvasStore((state) => [state.nodes, state.edges]);
  const {
    undo,
    redo,
    canUndo: historyCanUndo,
    canRedo: historyCanRedo,
  } = useCanvasHistory();

  const {
    addNode,
    clearCanvas,
    saveCanvas,
    syncWithWorkflow,
    exportToWorkflow,
  } = useCanvasStore();

  // Toolbar action handlers
  const handleAddNode = useCallback(
    (nodeType: CanvasNodeType) => {
      const nodeId = addNode(nodeType);

      return nodeId;
    },
    [addNode]
  );

  const handleClearCanvas = useCallback(() => {
    clearCanvas();
  }, [clearCanvas]);

  const handleSaveCanvas = useCallback(() => {
    saveCanvas();
    const defaultConfig = {
      showGrid: true,
      showMinimap: true,
      showControls: true,
      nodeSpacing: { x: 200, y: 150 },
      maxZoom: 2,
      minZoom: 0.1,
      autoSave: false,
      autoSaveInterval: 30000,
      enableAnimations: true,
      theme: {
        primaryColor: "#14b8a6",
        secondaryColor: "#06b6d4",
        backgroundColor: "#f8fafc",
        textColor: "#334155",
        borderColor: "#e2e8f0",
      },
    };
    const success = saveCanvasToStorage(
      nodes,
      edges,
      { x: 0, y: 0, zoom: 0.5 },
      defaultConfig
    );
  }, [saveCanvas, nodes, edges]);

  const handleExportCanvas = useCallback(() => {
    const defaultConfig = {
      showGrid: true,
      showMinimap: true,
      showControls: true,
      nodeSpacing: { x: 200, y: 150 },
      maxZoom: 2,
      minZoom: 0.1,
      autoSave: false,
      autoSaveInterval: 30000,
      enableAnimations: true,
      theme: {
        primaryColor: "#14b8a6",
        secondaryColor: "#06b6d4",
        backgroundColor: "#f8fafc",
        textColor: "#334155",
        borderColor: "#e2e8f0",
      },
    };
    exportCanvasAsFile(nodes, edges, { x: 0, y: 0, zoom: 0.5 }, defaultConfig);
  }, [nodes, edges]);

  const handleImportCanvas = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const imported = await importCanvasFromFile(file);
          if (imported) {
            useCanvasStore.getState().loadCanvas({
              nodes: imported.nodes,
              edges: imported.edges,
            });
          } else {
          }
        } catch (error) {}
      }
    };
    input.click();
  }, []);

  const handleSyncWorkflow = useCallback(() => {
    syncWithWorkflow();
    exportToWorkflow();
  }, [syncWithWorkflow, exportToWorkflow]);

  const handleAutoLayout = useCallback(() => {
    // Auto layout logic here
  }, []);

  return (
    <>
      <CanvasToolbar
        onAddNode={handleAddNode}
        onClearCanvas={handleClearCanvas}
        onSaveCanvas={handleSaveCanvas}
        onExportCanvas={handleExportCanvas}
        onImportCanvas={handleImportCanvas}
        onSyncWorkflow={handleSyncWorkflow}
        onAutoLayout={handleAutoLayout}
        canUndo={historyCanUndo}
        canRedo={historyCanRedo}
        onUndo={undo}
        onRedo={redo}
      />
      <div className="flex-1 overflow-hidden">
        <WorkflowCanvasContent />
      </div>
    </>
  );
};
