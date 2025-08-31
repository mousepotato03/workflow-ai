import { 
  CanvasNode,
  CanvasNodeType,
  SubtaskNodeData,
  MainTaskNodeData,
  GuideCardNodeData,
  SubtaskNodeStatus,
  CanvasUtils,
  isSubtaskNodeData,
  isMainTaskNodeData,
  isGuideCardNodeData
} from "@/types/canvas";
import type { Task } from "@/features/workflow/hooks/useWorkflowStore";

/**
 * Converts a workflow Task to a canvas SubtaskNode
 */
export function taskToCanvasNode(
  task: Task, 
  position: { x: number; y: number }
): CanvasNode<SubtaskNodeData> {
  return {
    id: `subtask-${task.id}`,
    type: CanvasNodeType.SUBTASK,
    position,
    data: {
      label: task.name.slice(0, 20) + (task.name.length > 20 ? '...' : ''),
      nodeId: `subtask-${task.id}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      taskDescription: task.name,
      taskId: task.id,
      status: determineNodeStatus(task),
      recommendedTool: task.recommendedTool as any,
      recommendationReason: task.recommendationReason,
      confidence: task.confidence,
      hasToolRecommendation: task.hasToolRecommendation || false,
      progress: task.hasToolRecommendation ? 100 : 0,
      isEditing: false,
    },
    deletable: true,
  };
}

/**
 * Converts a canvas SubtaskNode to a workflow Task
 */
export function canvasNodeToTask(node: CanvasNode<SubtaskNodeData>): Omit<Task, 'order'> {
  return {
    id: node.data.taskId || crypto.randomUUID(),
    name: node.data.taskDescription,
    recommendedTool: node.data.recommendedTool as any || null,
    recommendationReason: node.data.recommendationReason || "Canvas generated task",
    confidence: node.data.confidence || 0.5,
    hasToolRecommendation: node.data.hasToolRecommendation || false,
    usageGuidance: undefined, // This would come from guide cards
  };
}

/**
 * Determines the appropriate node status based on task state
 */
function determineNodeStatus(task: Task): SubtaskNodeStatus {
  if (task.recommendedTool) {
    return SubtaskNodeStatus.RECOMMENDED;
  }
  if (task.hasToolRecommendation) {
    return SubtaskNodeStatus.RECOMMENDED;
  }
  return SubtaskNodeStatus.IDLE;
}

/**
 * Converts workflow data to canvas format for import
 */
export function workflowToCanvasData(workflowData: {
  goal: string;
  tasks: Task[];
}): {
  mainTaskData: Partial<MainTaskNodeData>;
  subtaskNodes: CanvasNode<SubtaskNodeData>[];
} {
  const mainTaskData: Partial<MainTaskNodeData> = {
    goal: workflowData.goal,
    updatedAt: new Date(),
  };

  const subtaskNodes = workflowData.tasks.map((task, index) => {
    const position = calculateTaskPosition(index, workflowData.tasks.length);
    return taskToCanvasNode(task, position);
  });

  return {
    mainTaskData,
    subtaskNodes,
  };
}

/**
 * Converts canvas data to workflow format for export
 */
export function canvasToWorkflowData(nodes: CanvasNode[]): {
  goal: string;
  tasks: Task[];
} {
  const mainTaskNode = nodes.find(node => node.type === CanvasNodeType.MAIN_TASK);
  const subtaskNodes = nodes.filter(node => node.type === CanvasNodeType.SUBTASK);

  const goal = mainTaskNode && isMainTaskNodeData(mainTaskNode.data) 
    ? mainTaskNode.data.goal 
    : "";

  const tasks: Task[] = subtaskNodes
    .map((node, index) => {
      if (isSubtaskNodeData(node.data)) {
        return {
          ...canvasNodeToTask(node as CanvasNode<SubtaskNodeData>),
          order: index + 1,
        };
      }
      return null;
    })
    .filter((task): task is Task => task !== null);

  return {
    goal,
    tasks,
  };
}

/**
 * Calculate optimal position for a task node based on its index
 */
function calculateTaskPosition(
  index: number, 
  totalTasks: number
): { x: number; y: number } {
  const baseY = 300; // Start below main task
  const nodeWidth = 250;
  const nodeHeight = 200;
  const spacing = { x: 50, y: 50 };
  
  // Arrange in a grid pattern
  const columns = Math.min(3, Math.ceil(Math.sqrt(totalTasks)));
  const col = index % columns;
  const row = Math.floor(index / columns);
  
  return {
    x: 100 + col * (nodeWidth + spacing.x),
    y: baseY + row * (nodeHeight + spacing.y),
  };
}

/**
 * Creates a guide card node from task and guide data
 */
export function createGuideCardFromTask(
  task: Task,
  guideContent: string,
  associatedNodeId: string,
  position: { x: number; y: number }
): CanvasNode<GuideCardNodeData> {
  return {
    id: CanvasUtils.generateNodeId(CanvasNodeType.GUIDE_CARD),
    type: CanvasNodeType.GUIDE_CARD,
    position,
    data: {
      label: `Guide: ${task.name.slice(0, 15)}...`,
      nodeId: CanvasUtils.generateNodeId(CanvasNodeType.GUIDE_CARD),
      createdAt: new Date(),
      updatedAt: new Date(),
      title: `${task.name} - Implementation Guide`,
      content: guideContent,
      isCollapsed: false,
      associatedSubtaskId: associatedNodeId,
      tool: task.recommendedTool as any || undefined,
      isEditable: true,
      isUserModified: false,
      isEditing: false,
    },
    deletable: true,
  };
}

/**
 * Batch converter for importing multiple workflow results
 */
export function batchWorkflowToCanvas(
  workflowResults: Array<{ goal: string; tasks: Task[] }>
): CanvasNode[] {
  const allNodes: CanvasNode[] = [];
  
  workflowResults.forEach((workflow, workflowIndex) => {
    const { mainTaskData, subtaskNodes } = workflowToCanvasData(workflow);
    
    // Create main task node for this workflow
    const mainTaskNode: CanvasNode<MainTaskNodeData> = {
      id: CanvasUtils.generateNodeId(CanvasNodeType.MAIN_TASK),
      type: CanvasNodeType.MAIN_TASK,
      position: { 
        x: 250 + workflowIndex * 600, 
        y: 100 
      },
      data: {
        label: 'Main Task',
        nodeId: CanvasUtils.generateNodeId(CanvasNodeType.MAIN_TASK),
        createdAt: new Date(),
        updatedAt: new Date(),
        goal: mainTaskData.goal || '',
        isLocked: workflowIndex === 0, // Only first one is locked
        isEditing: false,
      },
      deletable: workflowIndex !== 0,
    };
    
    // Offset subtask positions for multiple workflows
    const offsetSubtasks = subtaskNodes.map(node => ({
      ...node,
      position: {
        x: node.position.x + workflowIndex * 600,
        y: node.position.y
      }
    }));
    
    allNodes.push(mainTaskNode, ...offsetSubtasks);
  });
  
  return allNodes;
}

/**
 * Validates that canvas data can be safely converted to workflow
 */
export function validateCanvasForWorkflowExport(nodes: CanvasNode[]): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const mainTaskNodes = nodes.filter(node => node.type === CanvasNodeType.MAIN_TASK);
  const subtaskNodes = nodes.filter(node => node.type === CanvasNodeType.SUBTASK);
  
  // Check main task requirements
  if (mainTaskNodes.length === 0) {
    errors.push("No main task node found. At least one main task is required.");
  } else if (mainTaskNodes.length > 1) {
    warnings.push("Multiple main task nodes found. Only the first one will be exported.");
  }
  
  // Validate main task data
  const mainTask = mainTaskNodes[0];
  if (mainTask && isMainTaskNodeData(mainTask.data)) {
    if (!mainTask.data.goal.trim()) {
      errors.push("Main task goal cannot be empty.");
    }
  }
  
  // Validate subtasks
  if (subtaskNodes.length === 0) {
    warnings.push("No subtask nodes found. The exported workflow will have no tasks.");
  }
  
  subtaskNodes.forEach((node, index) => {
    if (isSubtaskNodeData(node.data)) {
      if (!node.data.taskDescription.trim()) {
        errors.push(`Subtask ${index + 1} has empty task description.`);
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Merges canvas changes back to workflow store
 */
export function syncCanvasChangesToWorkflow(
  canvasNodes: CanvasNode[],
  currentWorkflowTasks: Task[]
): {
  tasksToAdd: Omit<Task, 'order'>[];
  tasksToUpdate: { taskId: string; updates: Partial<Task> }[];
  tasksToDelete: string[];
} {
  const subtaskNodes = canvasNodes.filter(node => 
    node.type === CanvasNodeType.SUBTASK && isSubtaskNodeData(node.data)
  );
  
  const tasksToAdd: Omit<Task, 'order'>[] = [];
  const tasksToUpdate: { taskId: string; updates: Partial<Task> }[] = [];
  const currentTaskIds = new Set(currentWorkflowTasks.map(t => t.id));
  const canvasTaskIds = new Set();
  
  // Process canvas nodes
  subtaskNodes.forEach(node => {
    if (isSubtaskNodeData(node.data)) {
      const subtaskData = node.data as SubtaskNodeData;
      if (subtaskData.taskId) {
        canvasTaskIds.add(subtaskData.taskId);
        
        // Check if task exists and needs updates
        const currentTask = currentWorkflowTasks.find(t => t.id === subtaskData.taskId);
        if (currentTask) {
          const updates: Partial<Task> = {};
          if (currentTask.name !== subtaskData.taskDescription) {
            updates.name = subtaskData.taskDescription;
          }
          if (currentTask.recommendedTool !== subtaskData.recommendedTool) {
            updates.recommendedTool = subtaskData.recommendedTool as any;
          }
          if (currentTask.confidence !== subtaskData.confidence) {
            updates.confidence = subtaskData.confidence;
          }
          
          if (Object.keys(updates).length > 0) {
            tasksToUpdate.push({
              taskId: subtaskData.taskId,
              updates
            });
          }
        }
      } else if (subtaskData.taskDescription.trim()) {
        // New task to add
        tasksToAdd.push(canvasNodeToTask(node as CanvasNode<SubtaskNodeData>));
      }
    }
  });
  
  // Find tasks to delete (exist in workflow but not in canvas)
  const tasksToDelete = currentWorkflowTasks
    .filter(task => !canvasTaskIds.has(task.id))
    .map(task => task.id);
  
  return {
    tasksToAdd,
    tasksToUpdate,
    tasksToDelete,
  };
}