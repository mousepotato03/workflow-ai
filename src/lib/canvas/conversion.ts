/**
 * Conversion utilities for transforming between workflow tasks and canvas nodes
 */

import { 
  CanvasNode,
  CanvasNodeType,
  MainTaskNodeData,
  SubtaskNodeData,
  GuideCardNodeData,
  SubtaskNodeStatus,
  CanvasUtils
} from '@/types/canvas';
import { Task } from '@/features/workflow/hooks/useWorkflowStore';

/**
 * Convert a workflow Task to a SubtaskNode
 */
export function taskToSubtaskNode(
  task: Task, 
  position: { x: number; y: number }
): CanvasNode<SubtaskNodeData> {
  const nodeId = CanvasUtils.generateNodeId(CanvasNodeType.SUBTASK);
  
  return {
    id: nodeId,
    type: CanvasNodeType.SUBTASK,
    position,
    data: {
      label: task.name,
      nodeId,
      createdAt: new Date(),
      updatedAt: new Date(),
      taskDescription: task.name,
      taskId: task.id,
      status: task.recommendedTool 
        ? SubtaskNodeStatus.RECOMMENDED 
        : SubtaskNodeStatus.IDLE,
      recommendedTool: task.recommendedTool ? {
        id: task.recommendedTool.id,
        name: task.recommendedTool.name,
        logoUrl: task.recommendedTool.logoUrl,
        url: task.recommendedTool.url
      } : undefined,
      recommendationReason: task.recommendationReason || undefined,
      confidence: task.confidence || undefined,
      hasToolRecommendation: task.hasToolRecommendation || false,
      progress: task.recommendedTool ? 100 : 0
    },
    draggable: true,
    selectable: true,
    deletable: true
  };
}

/**
 * Convert a SubtaskNode to a workflow Task
 */
export function subtaskNodeToTask(node: CanvasNode<SubtaskNodeData>): Task {
  const data = node.data;
  
  return {
    id: data.taskId || node.id,
    name: data.taskDescription,
    order: 1, // Will be set properly when adding to workflow
    recommendedTool: data.recommendedTool || null,
    recommendationReason: data.recommendationReason || "",
    confidence: data.confidence || 1.0,
    hasToolRecommendation: data.hasToolRecommendation || false,
    usageGuidance: undefined
  };
}

/**
 * Convert workflow goal to MainTaskNode
 */
export function goalToMainTaskNode(
  goal: string, 
  description?: string,
  position: { x: number; y: number } = { x: 250, y: 100 }
): CanvasNode<MainTaskNodeData> {
  const nodeId = CanvasUtils.generateNodeId(CanvasNodeType.MAIN_TASK);
  
  return {
    id: nodeId,
    type: CanvasNodeType.MAIN_TASK,
    position,
    data: {
      label: 'Main Goal',
      nodeId,
      createdAt: new Date(),
      updatedAt: new Date(),
      goal,
      description,
      isLocked: true
    },
    draggable: true,
    selectable: true,
    deletable: false
  };
}

/**
 * Convert multiple tasks to positioned subtask nodes
 */
export function tasksToSubtaskNodes(
  tasks: Task[], 
  startPosition: { x: number; y: number } = { x: 100, y: 250 },
  spacing: { x: number; y: number } = { x: 250, y: 200 }
): CanvasNode<SubtaskNodeData>[] {
  return tasks.map((task, index) => {
    const position = {
      x: startPosition.x + (index % 3) * spacing.x,
      y: startPosition.y + Math.floor(index / 3) * spacing.y
    };
    
    return taskToSubtaskNode(task, position);
  });
}

/**
 * Create guide card node from task and guide content
 */
export function createGuideCardNode(
  task: Task,
  guideContent: string,
  associatedSubtaskId: string,
  position: { x: number; y: number }
): CanvasNode<GuideCardNodeData> {
  const nodeId = CanvasUtils.generateNodeId(CanvasNodeType.GUIDE_CARD);
  
  return {
    id: nodeId,
    type: CanvasNodeType.GUIDE_CARD,
    position,
    data: {
      label: 'Implementation Guide',
      nodeId,
      createdAt: new Date(),
      updatedAt: new Date(),
      title: `${task.name} - Implementation Guide`,
      content: guideContent,
      isCollapsed: false,
      associatedSubtaskId,
      tool: task.recommendedTool ? {
        id: task.recommendedTool.id,
        name: task.recommendedTool.name,
        logoUrl: task.recommendedTool.logoUrl,
        url: task.recommendedTool.url
      } : undefined,
      isEditable: true,
      isUserModified: false
    },
    draggable: true,
    selectable: true,
    deletable: true
  };
}

/**
 * Batch conversion utilities
 */
export const BatchConversion = {
  /**
   * Convert entire workflow result to canvas nodes
   */
  workflowToNodes: (
    goal: string,
    tasks: Task[],
    description?: string
  ): CanvasNode[] => {
    const nodes: CanvasNode[] = [];
    
    // Add main task node
    nodes.push(goalToMainTaskNode(goal, description));
    
    // Add subtask nodes
    nodes.push(...tasksToSubtaskNodes(tasks));
    
    return nodes;
  },

  /**
   * Extract workflow data from canvas nodes
   */
  nodesToWorkflow: (nodes: CanvasNode[]): { goal: string; tasks: Task[] } => {
    const mainTaskNode = nodes.find(n => n.type === CanvasNodeType.MAIN_TASK) as CanvasNode<MainTaskNodeData>;
    const subtaskNodes = nodes.filter(n => n.type === CanvasNodeType.SUBTASK) as CanvasNode<SubtaskNodeData>[];
    
    const goal = mainTaskNode ? mainTaskNode.data.goal : "";
    const tasks = subtaskNodes.map((node, index) => ({
      ...subtaskNodeToTask(node),
      order: index + 1
    }));
    
    return { goal, tasks };
  }
};

/**
 * Node data validation and sanitization
 */
export const NodeValidation = {
  /**
   * Validate subtask node data
   */
  validateSubtaskData: (data: Partial<SubtaskNodeData>): boolean => {
    return Boolean(data.taskDescription?.trim());
  },

  /**
   * Validate main task node data
   */
  validateMainTaskData: (data: Partial<MainTaskNodeData>): boolean => {
    return Boolean(data.goal?.trim());
  },

  /**
   * Sanitize node data
   */
  sanitizeNodeData: (data: any): any => {
    const sanitized = { ...data };
    
    // Remove undefined values
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === undefined) {
        delete sanitized[key];
      }
    });
    
    // Ensure timestamps are Date objects
    if (sanitized.createdAt && !(sanitized.createdAt instanceof Date)) {
      sanitized.createdAt = new Date(sanitized.createdAt);
    }
    if (sanitized.updatedAt && !(sanitized.updatedAt instanceof Date)) {
      sanitized.updatedAt = new Date(sanitized.updatedAt);
    }
    
    return sanitized;
  }
};

/**
 * Node positioning utilities
 */
export const NodePositioning = {
  /**
   * Calculate optimal position for a new subtask node relative to main task
   */
  getSubtaskPosition: (
    mainTaskPosition: { x: number; y: number },
    index: number,
    spacing: { x: number; y: number } = { x: 250, y: 150 }
  ): { x: number; y: number } => {
    const radius = 200;
    const angle = (index * 60) * (Math.PI / 180); // 60 degrees between nodes
    
    return {
      x: mainTaskPosition.x + Math.cos(angle) * radius,
      y: mainTaskPosition.y + Math.sin(angle) * radius + 100
    };
  },

  /**
   * Calculate position for guide card relative to subtask
   */
  getGuidePosition: (
    subtaskPosition: { x: number; y: number },
    offset: { x: number; y: number } = { x: 300, y: 0 }
  ): { x: number; y: number } => {
    return {
      x: subtaskPosition.x + offset.x,
      y: subtaskPosition.y + offset.y
    };
  },

  /**
   * Check if two positions overlap
   */
  positionsOverlap: (
    pos1: { x: number; y: number },
    pos2: { x: number; y: number },
    threshold: { x: number; y: number } = { x: 150, y: 100 }
  ): boolean => {
    return Math.abs(pos1.x - pos2.x) < threshold.x && 
           Math.abs(pos1.y - pos2.y) < threshold.y;
  },

  /**
   * Find non-overlapping position
   */
  findNonOverlappingPosition: (
    desiredPosition: { x: number; y: number },
    existingPositions: { x: number; y: number }[],
    spacing: { x: number; y: number } = { x: 200, y: 150 }
  ): { x: number; y: number } => {
    let position = { ...desiredPosition };
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
      const overlapping = existingPositions.some(existing => 
        NodePositioning.positionsOverlap(position, existing, spacing)
      );
      
      if (!overlapping) {
        break;
      }
      
      // Try different positions
      position.x += spacing.x * 0.5;
      if (attempts % 5 === 0) {
        position.y += spacing.y * 0.5;
        position.x = desiredPosition.x;
      }
      
      attempts++;
    }
    
    return position;
  }
};