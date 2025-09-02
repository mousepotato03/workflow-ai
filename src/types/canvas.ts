import {
  Node,
  Edge,
  NodeProps,
  NodeChange,
  EdgeChange,
  Connection,
} from "reactflow";
import { Task } from "@/features/workflow/hooks/useWorkflowStore";

// Simple tool interface for canvas usage
export interface CanvasTool {
  id: string;
  name: string;
  logoUrl: string;
  url: string;
}

// Guide generation status interface for canvas usage
export interface CanvasGuideGenerationStatus {
  status: "pending" | "generating" | "completed" | "error";
  progress: number;
  guide?: string;
  error?: string;
}

/**
 * Enumeration of canvas node types supported by the React Flow implementation.
 * Each type corresponds to a specific custom node component.
 */
export enum CanvasNodeType {
  /** Main task node - central node containing the primary workflow goal */
  MAIN_TASK = "mainTaskNode",
  /** Subtask node with AI integration for tool recommendations */
  SUBTASK = "subtaskNode",
  /** Guide card node for displaying detailed implementation guides */
  GUIDE_CARD = "guideCardNode",
  /** Basic shape nodes for visual organization */
  RECTANGLE = "rectangleNode",
  /** Diamond-shaped decision nodes */
  DIAMOND = "diamondNode",
  /** Simple text annotation nodes */
  TEXT = "textNode",
}

/**
 * Status states for subtask nodes during AI processing lifecycle.
 */
export enum SubtaskNodeStatus {
  /** Initial state - awaiting user input */
  IDLE = "idle",
  /** AI is analyzing the task for tool recommendations */
  ANALYZING = "analyzing",
  /** Tool recommendation completed successfully */
  RECOMMENDED = "recommended",
  /** Guide generation is in progress */
  GENERATING_GUIDE = "generating_guide",
  /** Guide has been generated and linked */
  GUIDE_GENERATED = "guide_generated",
  /** Error occurred during processing */
  ERROR = "error",
}

/**
 * Base interface for all canvas node data.
 * Extends this interface for specific node type data.
 */
export interface BaseNodeData {
  /** Human-readable label for the node */
  label: string;
  /** Unique identifier for this node instance */
  nodeId: string;
  /** Timestamp when the node was created */
  createdAt: Date;
  /** Timestamp when the node was last modified */
  updatedAt: Date;
  /** Whether the node is currently selected */
  isSelected?: boolean;
  /** Whether the node is in edit mode */
  isEditing?: boolean;
}

/**
 * Data structure for the main task node.
 * There should only be one main task node per canvas, positioned centrally.
 */
export interface MainTaskNodeData extends BaseNodeData {
  /** The primary workflow goal entered by the user */
  goal: string;
  /** Description or additional context for the workflow */
  description?: string;
  /** Whether this is a locked node (cannot be deleted) */
  isLocked: boolean;
  /** Node dimensions for consistent sizing */
  width?: number;
  height?: number;
}

/**
 * Data structure for subtask nodes with AI integration capabilities.
 * These nodes interact with the FlowGenius AI engine for tool recommendations.
 */
export interface SubtaskNodeData extends BaseNodeData {
  /** The specific task or problem this node represents */
  taskDescription: string;
  /** Current processing status of the node */
  status: SubtaskNodeStatus;
  /** Reference to the associated Task from the workflow store */
  taskId?: string;
  /** AI-recommended tool for this subtask */
  recommendedTool?: CanvasTool | null;
  /** AI-generated reason for the tool recommendation */
  recommendationReason?: string;
  /** Confidence score for the recommendation (0-1) */
  confidence?: number;
  /** Whether tool recommendation has been generated */
  hasToolRecommendation?: boolean;
  /** Progress indicator for async operations (0-100) */
  progress?: number;
  /** Error message if processing failed */
  errorMessage?: string;
  /** ID of the connected guide card node (if any) */
  connectedGuideId?: string;
}

/**
 * Data structure for guide card nodes that display detailed implementation guides.
 * These nodes are typically generated automatically and linked to subtask nodes.
 */
export interface GuideCardNodeData extends BaseNodeData {
  /** Title of the guide */
  title: string;
  /** Markdown content of the guide */
  content: string;
  /** Whether the guide content is currently collapsed */
  isCollapsed: boolean;
  /** ID of the associated subtask node */
  associatedSubtaskId: string;
  /** Associated tool information */
  tool?: CanvasTool;
  /** Guide generation status from the workflow store */
  generationStatus?: CanvasGuideGenerationStatus;
  /** Whether the guide content is editable by the user */
  isEditable: boolean;
  /** Auto-generated or user-modified flag */
  isUserModified: boolean;
}

/**
 * Data structure for basic shape nodes (rectangle, diamond, etc.).
 * Used for visual organization and workflow structure.
 */
export interface ShapeNodeData extends BaseNodeData {
  /** Background color of the shape */
  backgroundColor?: string;
  /** Border color of the shape */
  borderColor?: string;
  /** Text color */
  textColor?: string;
  /** Additional styling properties */
  style?: React.CSSProperties;
}

/**
 * Data structure for simple text annotation nodes.
 * Used for adding comments and notes to the canvas.
 */
export interface TextNodeData extends BaseNodeData {
  /** The text content */
  text: string;
  /** Font size */
  fontSize?: number;
  /** Font weight */
  fontWeight?: "normal" | "bold" | "lighter";
  /** Text alignment */
  textAlign?: "left" | "center" | "right";
  /** Text color */
  color?: string;
}

/**
 * Union type for all possible node data types.
 * Used for type-safe handling of different node types.
 */
export type CanvasNodeData =
  | MainTaskNodeData
  | SubtaskNodeData
  | GuideCardNodeData
  | ShapeNodeData
  | TextNodeData;

/**
 * Enhanced Node type with our custom data structure.
 * Extends React Flow's base Node type with our specific data types.
 */
export interface CanvasNode<T extends CanvasNodeData = CanvasNodeData>
  extends Node<T> {
  /** Node type from our CanvasNodeType enum */
  type: CanvasNodeType;
  /** Custom data payload */
  data: T;
}

/**
 * Specialized node types for type-safe operations.
 */
export type MainTaskNode = CanvasNode<MainTaskNodeData>;
export type SubtaskNode = CanvasNode<SubtaskNodeData>;
export type GuideCardNode = CanvasNode<GuideCardNodeData>;
export type ShapeNode = CanvasNode<ShapeNodeData>;
export type TextNode = CanvasNode<TextNodeData>;

/**
 * Props interface for MainTaskNode component.
 */
export interface MainTaskNodeProps extends NodeProps<MainTaskNodeData> {
  /** Callback when the goal is updated */
  onGoalUpdate?: (goal: string) => void;
  /** Callback when edit mode is toggled */
  onEditToggle?: (isEditing: boolean) => void;
  /** Callback when node size is updated */
  onSizeUpdate?: (width: number, height: number) => void;
}

/**
 * Props interface for SubtaskNode component.
 */
export interface SubtaskNodeProps extends NodeProps<SubtaskNodeData> {
  /** Callback when task description is updated */
  onTaskUpdate?: (taskDescription: string) => void;
  /** Callback to generate tool recommendations */
  onGenerateRecommendation?: () => void;
  /** Callback to manually edit/select a tool */
  onEditTool?: () => void;
  /** Callback to generate implementation guide */
  onGenerateGuide?: () => void;
  /** Callback when node status changes */
  onStatusChange?: (status: SubtaskNodeStatus) => void;
}

/**
 * Props interface for GuideCardNode component.
 */
export interface GuideCardNodeProps extends NodeProps<GuideCardNodeData> {
  /** Callback when guide content is updated */
  onContentUpdate?: (content: string) => void;
  /** Callback when collapse state changes */
  onCollapseToggle?: (isCollapsed: boolean) => void;
  /** Callback to edit guide content */
  onEditContent?: (content: string) => void;
}

/**
 * Enhanced Edge type with custom styling and behavior.
 */
export interface CanvasEdge extends Edge {
  /** Unique edge identifier */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Edge type for different visual styles */
  type?: "default" | "smoothstep" | "straight" | "step" | "simplebezier";
  /** Whether this edge was auto-generated (e.g., subtask to guide connection) */
  isAutoGenerated?: boolean;
  /** Custom styling for the edge */
  style?: React.CSSProperties;
  /** Animation properties */
  animated?: boolean;
  /** Custom label for the edge */
  label?: string;
}

/**
 * Canvas state management interface.
 * Manages the overall state of the React Flow canvas.
 */
export interface CanvasState {
  /** All nodes currently on the canvas */
  nodes: CanvasNode[];
  /** All edges connecting the nodes */
  edges: CanvasEdge[];
  /** The main task node (should always exist) */
  mainTaskNode: MainTaskNode | null;
  /** Currently selected node IDs */
  selectedNodeIds: string[];
  /** Currently selected edge IDs */
  selectedEdgeIds: string[];
  /** Whether the canvas is in edit mode */
  isEditing: boolean;
  /** Current zoom level */
  zoomLevel: number;
  /** Canvas viewport position and zoom */
  viewport: { x: number; y: number; zoom: number };
  /** Whether AI operations are in progress */
  isProcessing: boolean;
  /** History for undo/redo functionality */
  history: CanvasHistoryEntry[];
  /** Current position in history */
  historyIndex: number;
}

/**
 * History entry for undo/redo functionality.
 */
export interface CanvasHistoryEntry {
  /** Timestamp of this state */
  timestamp: Date;
  /** Description of the action that led to this state */
  action: string;
  /** Canvas state snapshot */
  state: {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
  };
}

/**
 * Canvas action types for state management.
 */
export enum CanvasActionType {
  // Node operations
  ADD_NODE = "ADD_NODE",
  UPDATE_NODE = "UPDATE_NODE",
  DELETE_NODE = "DELETE_NODE",
  MOVE_NODE = "MOVE_NODE",
  SELECT_NODE = "SELECT_NODE",
  DESELECT_NODE = "DESELECT_NODE",

  // Edge operations
  ADD_EDGE = "ADD_EDGE",
  UPDATE_EDGE = "UPDATE_EDGE",
  DELETE_EDGE = "DELETE_EDGE",
  SELECT_EDGE = "SELECT_EDGE",
  DESELECT_EDGE = "DESELECT_EDGE",

  // Batch operations
  NODES_CHANGE = "NODES_CHANGE",
  EDGES_CHANGE = "EDGES_CHANGE",

  // Canvas operations
  SET_VIEWPORT = "SET_VIEWPORT",
  SET_ZOOM = "SET_ZOOM",
  CLEAR_CANVAS = "CLEAR_CANVAS",
  RESET_CANVAS = "RESET_CANVAS",

  // AI operations
  START_AI_PROCESSING = "START_AI_PROCESSING",
  COMPLETE_AI_PROCESSING = "COMPLETE_AI_PROCESSING",
  AI_PROCESSING_ERROR = "AI_PROCESSING_ERROR",

  // History operations
  UNDO = "UNDO",
  REDO = "REDO",
  SAVE_HISTORY_POINT = "SAVE_HISTORY_POINT",
}

/**
 * Base interface for all canvas actions.
 */
export interface BaseCanvasAction {
  type: CanvasActionType;
  timestamp?: Date;
}

/**
 * Action interfaces for different operations.
 */
export interface AddNodeAction extends BaseCanvasAction {
  type: CanvasActionType.ADD_NODE;
  payload: {
    node: CanvasNode;
    position?: { x: number; y: number };
  };
}

export interface UpdateNodeAction extends BaseCanvasAction {
  type: CanvasActionType.UPDATE_NODE;
  payload: {
    nodeId: string;
    data: Partial<CanvasNodeData>;
  };
}

export interface DeleteNodeAction extends BaseCanvasAction {
  type: CanvasActionType.DELETE_NODE;
  payload: {
    nodeId: string;
  };
}

export interface NodesChangeAction extends BaseCanvasAction {
  type: CanvasActionType.NODES_CHANGE;
  payload: {
    changes: NodeChange[];
  };
}

export interface EdgesChangeAction extends BaseCanvasAction {
  type: CanvasActionType.EDGES_CHANGE;
  payload: {
    changes: EdgeChange[];
  };
}

export interface AddEdgeAction extends BaseCanvasAction {
  type: CanvasActionType.ADD_EDGE;
  payload: {
    connection: Connection;
    edge?: Partial<CanvasEdge>;
  };
}

/**
 * Union type for all possible canvas actions.
 */
export type CanvasAction =
  | AddNodeAction
  | UpdateNodeAction
  | DeleteNodeAction
  | NodesChangeAction
  | EdgesChangeAction
  | AddEdgeAction
  | BaseCanvasAction;

/**
 * Canvas actions interface for managing canvas state.
 * Provides methods for all canvas operations.
 */
export interface CanvasActions {
  // Node operations
  /** Add a new node to the canvas */
  addNode: (
    nodeType: CanvasNodeType,
    position?: { x: number; y: number },
    data?: Partial<CanvasNodeData>
  ) => string;

  /** Update an existing node's data */
  updateNode: (nodeId: string, data: Partial<CanvasNodeData>) => void;

  /** Delete a node from the canvas */
  deleteNode: (nodeId: string) => void;

  /** Move a node to a new position */
  moveNode: (nodeId: string, position: { x: number; y: number }) => void;

  /** Select one or more nodes */
  selectNodes: (nodeIds: string[]) => void;

  /** Deselect all nodes */
  deselectAllNodes: () => void;

  // Edge operations
  /** Add a new edge between nodes */
  addEdge: (connection: Connection, edgeData?: Partial<CanvasEdge>) => void;

  /** Update an existing edge */
  updateEdge: (edgeId: string, data: Partial<CanvasEdge>) => void;

  /** Delete an edge */
  deleteEdge: (edgeId: string) => void;

  // Batch operations
  /** Handle multiple node changes at once */
  onNodesChange: (changes: NodeChange[]) => void;

  /** Handle multiple edge changes at once */
  onEdgesChange: (changes: EdgeChange[]) => void;

  // AI integration operations
  /** Generate tool recommendation for a subtask node */
  generateToolRecommendation: (nodeId: string) => Promise<void>;

  /** Generate implementation guide for a subtask node */
  generateImplementationGuide: (nodeId: string) => Promise<void>;

  /** Auto-connect guide card to subtask node */
  connectGuideToSubtask: (subtaskId: string, guideId: string) => void;

  // Canvas operations
  /** Clear all nodes and edges */
  clearCanvas: () => void;

  /** Reset canvas to initial state with main task node */
  resetCanvas: () => void;

  /** Set viewport position and zoom */
  setViewport: (viewport: { x: number; y: number; zoom?: number }) => void;

  // History operations
  /** Undo last operation */
  undo: () => void;

  /** Redo last undone operation */
  redo: () => void;

  /** Save current state to history */
  saveHistoryPoint: (action: string) => void;

  /** Check if undo is available */
  canUndo: () => boolean;

  /** Check if redo is available */
  canRedo: () => boolean;
}

/**
 * Integration interface with the existing workflow store.
 * Provides seamless integration between canvas and workflow state.
 */
export interface CanvasWorkflowIntegration {
  /** Sync canvas subtask nodes with workflow store tasks */
  syncWithWorkflowStore: () => void;

  /** Create workflow task from subtask node */
  createTaskFromNode: (node: SubtaskNode) => string;

  /** Update workflow task from node data */
  updateTaskFromNode: (node: SubtaskNode) => void;

  /** Create subtask node from workflow task */
  createNodeFromTask: (
    task: Task,
    position: { x: number; y: number }
  ) => string;

  /** Handle workflow store changes */
  onWorkflowStoreChange: (tasks: Task[]) => void;

  /** Export canvas as workflow data */
  exportToWorkflow: () => { goal: string; tasks: Task[] };

  /** Import workflow data to canvas */
  importFromWorkflow: (workflowData: { goal: string; tasks: Task[] }) => void;
}

/**
 * Canvas configuration options.
 */
export interface CanvasConfig {
  /** Whether to enable grid background */
  showGrid: boolean;

  /** Whether to enable minimap */
  showMinimap: boolean;

  /** Whether to enable controls panel */
  showControls: boolean;

  /** Default node spacing */
  nodeSpacing: { x: number; y: number };

  /** Maximum zoom level */
  maxZoom: number;

  /** Minimum zoom level */
  minZoom: number;

  /** Whether to auto-save canvas state */
  autoSave: boolean;

  /** Auto-save interval in milliseconds */
  autoSaveInterval: number;

  /** Whether to enable animations */
  enableAnimations: boolean;

  /** Theme settings */
  theme: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    borderColor: string;
  };
}

/**
 * Canvas event handlers interface.
 * Defines all possible event callbacks for canvas interactions.
 */
export interface CanvasEventHandlers {
  /** Fired when a node is clicked */
  onNodeClick?: (event: React.MouseEvent, node: CanvasNode) => void;

  /** Fired when a node is double-clicked */
  onNodeDoubleClick?: (event: React.MouseEvent, node: CanvasNode) => void;

  /** Fired when an edge is clicked */
  onEdgeClick?: (event: React.MouseEvent, edge: CanvasEdge) => void;

  /** Fired when the canvas background is clicked */
  onPaneClick?: (event: React.MouseEvent) => void;

  /** Fired when nodes are selected */
  onSelectionChange?: (nodes: CanvasNode[], edges: CanvasEdge[]) => void;

  /** Fired when a connection is being created */
  onConnect?: (connection: Connection) => void;

  /** Fired before a connection is created (for validation) */
  onConnectStart?: (
    event: React.MouseEvent,
    handle: { nodeId: string; type: string; handleId?: string }
  ) => void;

  /** Fired when connection creation ends */
  onConnectEnd?: (event: MouseEvent | TouchEvent) => void;

  /** Fired when nodes are dragged */
  onNodeDrag?: (event: React.MouseEvent, node: CanvasNode) => void;

  /** Fired when viewport changes */
  onMove?: (
    event: React.MouseEvent,
    viewport: { x: number; y: number; zoom: number }
  ) => void;
}

/**
 * Type guard functions for node data types.
 */
export const isMainTaskNodeData = (
  data: CanvasNodeData
): data is MainTaskNodeData => {
  return "goal" in data && "isLocked" in data;
};

export const isSubtaskNodeData = (
  data: CanvasNodeData
): data is SubtaskNodeData => {
  return "taskDescription" in data && "status" in data;
};

export const isGuideCardNodeData = (
  data: CanvasNodeData
): data is GuideCardNodeData => {
  return "title" in data && "content" in data && "isCollapsed" in data;
};

export const isShapeNodeData = (
  data: CanvasNodeData
): data is ShapeNodeData => {
  return "backgroundColor" in data || "borderColor" in data;
};

export const isTextNodeData = (data: CanvasNodeData): data is TextNodeData => {
  return "text" in data && !("taskDescription" in data);
};

/**
 * Utility functions for canvas operations.
 */
export namespace CanvasUtils {
  /** Generate a unique node ID */
  export const generateNodeId = (type: CanvasNodeType): string => {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  /** Generate a unique edge ID */
  export const generateEdgeId = (
    sourceId: string,
    targetId: string
  ): string => {
    return `edge-${sourceId}-${targetId}`;
  };

  /** Calculate optimal position for a new node */
  export const calculateNodePosition = (
    existingNodes: Node[],
    nodeSpacing: { x: number; y: number }
  ): { x: number; y: number } => {
    if (existingNodes.length === 0) {
      return { x: 250, y: 250 };
    }

    // Find a position that doesn't overlap with existing nodes
    const positions = existingNodes.map((node) => node.position);
    let x = 100;
    let y = 100;

    while (
      positions.some(
        (pos) =>
          Math.abs(pos.x - x) < nodeSpacing.x &&
          Math.abs(pos.y - y) < nodeSpacing.y
      )
    ) {
      x += nodeSpacing.x;
      if (x > 800) {
        x = 100;
        y += nodeSpacing.y;
      }
    }

    return { x, y };
  };

  /** Create default node data for a given type */
  export const createDefaultNodeData = (
    type: CanvasNodeType
  ): CanvasNodeData => {
    const baseData: BaseNodeData = {
      label: "",
      nodeId: generateNodeId(type),
      createdAt: new Date(),
      updatedAt: new Date(),
      isSelected: false,
      isEditing: false,
    };

    switch (type) {
      case CanvasNodeType.MAIN_TASK:
        return {
          ...baseData,
          label: "Main Task",
          goal: "",
          isLocked: true,
        } as MainTaskNodeData;

      case CanvasNodeType.SUBTASK:
        return {
          ...baseData,
          label: "Subtask",
          taskDescription: "",
          status: SubtaskNodeStatus.IDLE,
          hasToolRecommendation: false,
          progress: 0,
        } as SubtaskNodeData;

      case CanvasNodeType.GUIDE_CARD:
        return {
          ...baseData,
          label: "Guide",
          title: "",
          content: "",
          isCollapsed: false,
          associatedSubtaskId: "",
          isEditable: true,
          isUserModified: false,
        } as GuideCardNodeData;

      case CanvasNodeType.RECTANGLE:
      case CanvasNodeType.DIAMOND:
        return {
          ...baseData,
          label: "Shape",
          backgroundColor: "#ffffff",
          borderColor: "#e5e7eb",
          textColor: "#374151",
        } as ShapeNodeData;

      case CanvasNodeType.TEXT:
        return {
          ...baseData,
          label: "Text",
          text: "Enter text here...",
          fontSize: 14,
          fontWeight: "normal",
          textAlign: "left",
          color: "#374151",
        } as TextNodeData;

      default:
        throw new Error(`Unknown node type: ${type}`);
    }
  };

  /** Validate node data integrity */
  export const validateNodeData = (
    type: CanvasNodeType,
    data: CanvasNodeData
  ): boolean => {
    switch (type) {
      case CanvasNodeType.MAIN_TASK:
        return isMainTaskNodeData(data) && Boolean(data.goal?.trim());

      case CanvasNodeType.SUBTASK:
        return isSubtaskNodeData(data) && Boolean(data.taskDescription?.trim());

      case CanvasNodeType.GUIDE_CARD:
        return (
          isGuideCardNodeData(data) &&
          Boolean(data.title?.trim()) &&
          Boolean(data.associatedSubtaskId)
        );

      case CanvasNodeType.RECTANGLE:
      case CanvasNodeType.DIAMOND:
        return isShapeNodeData(data);

      case CanvasNodeType.TEXT:
        return isTextNodeData(data) && Boolean(data.text?.trim());

      default:
        return false;
    }
  };
}

/**
 * Export all types for easy importing.
 */
export type {
  Node,
  Edge,
  NodeProps,
  NodeChange,
  EdgeChange,
  Connection,
} from "reactflow";
