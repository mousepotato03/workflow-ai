/**
 * Canvas validation utilities
 */

import { 
  CanvasNode, 
  CanvasEdge, 
  CanvasNodeType,
  CanvasNodeData,
  MainTaskNodeData,
  SubtaskNodeData,
  GuideCardNodeData,
  isMainTaskNodeData,
  isSubtaskNodeData,
  isGuideCardNodeData
} from '@/types/canvas';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a single canvas node
 */
export function validateNode(node: CanvasNode): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check basic node structure
  if (!node.id) {
    errors.push('Node missing ID');
  }

  if (!node.type) {
    errors.push('Node missing type');
  }

  if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
    errors.push('Node missing or invalid position');
  }

  if (!node.data) {
    errors.push('Node missing data');
    return { isValid: false, errors, warnings };
  }

  // Validate node-specific data
  switch (node.type) {
    case CanvasNodeType.MAIN_TASK:
      validateMainTaskNodeData(node.data, errors, warnings);
      break;
    case CanvasNodeType.SUBTASK:
      validateSubtaskNodeData(node.data, errors, warnings);
      break;
    case CanvasNodeType.GUIDE_CARD:
      validateGuideCardNodeData(node.data, errors, warnings);
      break;
    default:
      // Basic validation for other node types
      if (!node.data.label) {
        warnings.push(`Node ${node.id} missing label`);
      }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate main task node data
 */
function validateMainTaskNodeData(data: CanvasNodeData, errors: string[], warnings: string[]): void {
  if (!isMainTaskNodeData(data)) {
    errors.push('Invalid main task node data structure');
    return;
  }

  if (!data.goal || !data.goal.trim()) {
    errors.push('Main task node missing goal');
  }

  if (data.goal && data.goal.length > 200) {
    warnings.push('Main task goal is very long (>200 characters)');
  }
}

/**
 * Validate subtask node data
 */
function validateSubtaskNodeData(data: CanvasNodeData, errors: string[], warnings: string[]): void {
  if (!isSubtaskNodeData(data)) {
    errors.push('Invalid subtask node data structure');
    return;
  }

  if (!data.taskDescription || !data.taskDescription.trim()) {
    errors.push('Subtask node missing task description');
  }

  if (!data.status) {
    errors.push('Subtask node missing status');
  }

  if (data.taskDescription && data.taskDescription.length > 300) {
    warnings.push('Subtask description is very long (>300 characters)');
  }

  if (data.confidence !== undefined && (data.confidence < 0 || data.confidence > 1)) {
    errors.push('Subtask confidence must be between 0 and 1');
  }

  if (data.progress !== undefined && (data.progress < 0 || data.progress > 100)) {
    errors.push('Subtask progress must be between 0 and 100');
  }
}

/**
 * Validate guide card node data
 */
function validateGuideCardNodeData(data: CanvasNodeData, errors: string[], warnings: string[]): void {
  if (!isGuideCardNodeData(data)) {
    errors.push('Invalid guide card node data structure');
    return;
  }

  if (!data.title || !data.title.trim()) {
    errors.push('Guide card node missing title');
  }

  if (!data.content || !data.content.trim()) {
    warnings.push('Guide card node missing content');
  }

  if (!data.associatedSubtaskId) {
    warnings.push('Guide card node missing associated subtask ID');
  }
}

/**
 * Validate a canvas edge
 */
export function validateEdge(edge: CanvasEdge, nodes: CanvasNode[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check basic edge structure
  if (!edge.id) {
    errors.push('Edge missing ID');
  }

  if (!edge.source) {
    errors.push('Edge missing source node ID');
  }

  if (!edge.target) {
    errors.push('Edge missing target node ID');
  }

  if (edge.source === edge.target) {
    errors.push('Edge cannot connect a node to itself');
  }

  // Check if referenced nodes exist
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);

  if (!sourceNode) {
    errors.push(`Edge source node ${edge.source} does not exist`);
  }

  if (!targetNode) {
    errors.push(`Edge target node ${edge.target} does not exist`);
  }

  // Validate edge type combinations if both nodes exist
  if (sourceNode && targetNode) {
    const isValidConnection = isValidNodeConnection(sourceNode.type, targetNode.type);
    if (!isValidConnection) {
      warnings.push(`Unusual connection: ${sourceNode.type} → ${targetNode.type}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check if a node type connection is valid
 */
function isValidNodeConnection(sourceType: CanvasNodeType, targetType: CanvasNodeType): boolean {
  const validConnections: { [key in CanvasNodeType]?: CanvasNodeType[] } = {
    [CanvasNodeType.MAIN_TASK]: [CanvasNodeType.SUBTASK],
    [CanvasNodeType.SUBTASK]: [CanvasNodeType.SUBTASK, CanvasNodeType.GUIDE_CARD],
    [CanvasNodeType.RECTANGLE]: Object.values(CanvasNodeType),
    [CanvasNodeType.DIAMOND]: Object.values(CanvasNodeType),
    [CanvasNodeType.TEXT]: Object.values(CanvasNodeType)
  };

  const allowedTargets = validConnections[sourceType];
  return allowedTargets ? allowedTargets.includes(targetType) : false;
}

/**
 * Validate entire canvas state
 */
export function validateCanvas(nodes: CanvasNode[], edges: CanvasEdge[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate each node
  nodes.forEach(node => {
    const nodeValidation = validateNode(node);
    errors.push(...nodeValidation.errors.map(e => `Node ${node.id}: ${e}`));
    warnings.push(...nodeValidation.warnings.map(w => `Node ${node.id}: ${w}`));
  });

  // Validate each edge
  edges.forEach(edge => {
    const edgeValidation = validateEdge(edge, nodes);
    errors.push(...edgeValidation.errors.map(e => `Edge ${edge.id}: ${e}`));
    warnings.push(...edgeValidation.warnings.map(w => `Edge ${edge.id}: ${w}`));
  });

  // Check for duplicate node IDs
  const nodeIds = nodes.map(n => n.id);
  const duplicateNodeIds = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);
  duplicateNodeIds.forEach(id => {
    errors.push(`Duplicate node ID: ${id}`);
  });

  // Check for duplicate edge IDs
  const edgeIds = edges.map(e => e.id);
  const duplicateEdgeIds = edgeIds.filter((id, index) => edgeIds.indexOf(id) !== index);
  duplicateEdgeIds.forEach(id => {
    errors.push(`Duplicate edge ID: ${id}`);
  });

  // Canvas-specific validations
  const mainTaskNodes = nodes.filter(n => n.type === CanvasNodeType.MAIN_TASK);
  if (mainTaskNodes.length === 0) {
    warnings.push('Canvas has no main task node');
  } else if (mainTaskNodes.length > 1) {
    warnings.push('Canvas has multiple main task nodes');
  }

  // Check for orphaned guide cards
  const guideNodes = nodes.filter(n => n.type === CanvasNodeType.GUIDE_CARD);
  guideNodes.forEach(guide => {
    if (isGuideCardNodeData(guide.data)) {
      const hasSubtaskConnection = edges.some(edge => 
        edge.target === guide.id && 
        nodes.find(n => n.id === edge.source && n.type === CanvasNodeType.SUBTASK)
      );
      
      if (!hasSubtaskConnection) {
        warnings.push(`Guide node ${guide.id} is not connected to any subtask`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Auto-fix common canvas issues
 */
export function autoFixCanvas(nodes: CanvasNode[], edges: CanvasEdge[]): {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  fixesApplied: string[];
} {
  const fixedNodes = [...nodes];
  const fixedEdges = [...edges];
  const fixesApplied: string[] = [];

  // Remove duplicate node IDs (keep first occurrence)
  const seenNodeIds = new Set<string>();
  for (let i = fixedNodes.length - 1; i >= 0; i--) {
    if (seenNodeIds.has(fixedNodes[i].id)) {
      fixedNodes.splice(i, 1);
      fixesApplied.push(`Removed duplicate node ID: ${fixedNodes[i].id}`);
    } else {
      seenNodeIds.add(fixedNodes[i].id);
    }
  }

  // Remove duplicate edge IDs
  const seenEdgeIds = new Set<string>();
  for (let i = fixedEdges.length - 1; i >= 0; i--) {
    if (seenEdgeIds.has(fixedEdges[i].id)) {
      fixedEdges.splice(i, 1);
      fixesApplied.push(`Removed duplicate edge ID: ${fixedEdges[i].id}`);
    } else {
      seenEdgeIds.add(fixedEdges[i].id);
    }
  }

  // Remove edges that reference non-existent nodes
  const nodeIds = new Set(fixedNodes.map(n => n.id));
  for (let i = fixedEdges.length - 1; i >= 0; i--) {
    const edge = fixedEdges[i];
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      fixedEdges.splice(i, 1);
      fixesApplied.push(`Removed edge with invalid node reference: ${edge.id}`);
    }
  }

  // Fix node positions that are negative or extreme
  fixedNodes.forEach(node => {
    let positionFixed = false;
    if (node.position.x < 0) {
      node.position.x = 50;
      positionFixed = true;
    }
    if (node.position.y < 0) {
      node.position.y = 50;
      positionFixed = true;
    }
    if (node.position.x > 10000) {
      node.position.x = 500;
      positionFixed = true;
    }
    if (node.position.y > 10000) {
      node.position.y = 300;
      positionFixed = true;
    }
    if (positionFixed) {
      fixesApplied.push(`Fixed position for node: ${node.id}`);
    }
  });

  return {
    nodes: fixedNodes,
    edges: fixedEdges,
    fixesApplied
  };
}

/**
 * Validation utilities
 */
export const ValidationUtils = {
  /**
   * Check if canvas is empty
   */
  isEmpty: (nodes: CanvasNode[], edges: CanvasEdge[]): boolean => {
    return nodes.length === 0 && edges.length === 0;
  },

  /**
   * Get canvas statistics
   */
  getStats: (nodes: CanvasNode[], edges: CanvasEdge[]) => {
    const nodeTypesCounts = nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<CanvasNodeType, number>);

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodeTypes: nodeTypesCounts,
      hasMainTask: nodes.some(n => n.type === CanvasNodeType.MAIN_TASK),
      subtaskCount: nodeTypesCounts[CanvasNodeType.SUBTASK] || 0,
      guideCount: nodeTypesCounts[CanvasNodeType.GUIDE_CARD] || 0
    };
  },

  /**
   * Find nodes without connections
   */
  findIsolatedNodes: (nodes: CanvasNode[], edges: CanvasEdge[]): CanvasNode[] => {
    const connectedNodeIds = new Set<string>();
    edges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    return nodes.filter(node => !connectedNodeIds.has(node.id));
  }
};