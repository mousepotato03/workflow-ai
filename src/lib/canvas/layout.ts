import { Node } from 'reactflow';
import { 
  CanvasNode, 
  CanvasNodeType,
  isSubtaskNodeData,
  isMainTaskNodeData 
} from '@/types/canvas';

/**
 * Auto-layout algorithms for positioning nodes on the canvas
 */

export interface LayoutConfig {
  nodeSpacing: { x: number; y: number };
  direction: 'vertical' | 'horizontal' | 'grid' | 'circular' | 'hierarchical';
  centerOnMainTask: boolean;
  padding: { x: number; y: number };
}

const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  nodeSpacing: { x: 250, y: 200 },
  direction: 'grid',
  centerOnMainTask: true,
  padding: { x: 50, y: 50 }
};

/**
 * Apply auto-layout to all nodes
 */
export function autoLayoutNodes(
  nodes: CanvasNode[], 
  config: Partial<LayoutConfig> = {}
): CanvasNode[] {
  const layoutConfig = { ...DEFAULT_LAYOUT_CONFIG, ...config };
  
  const mainTaskNodes = nodes.filter(node => node.type === CanvasNodeType.MAIN_TASK);
  const subtaskNodes = nodes.filter(node => node.type === CanvasNodeType.SUBTASK);
  const guideNodes = nodes.filter(node => node.type === CanvasNodeType.GUIDE_CARD);
  const otherNodes = nodes.filter(node => 
    ![CanvasNodeType.MAIN_TASK, CanvasNodeType.SUBTASK, CanvasNodeType.GUIDE_CARD].includes(node.type)
  );

  let layoutNodes: CanvasNode[] = [];

  // Position main task node(s) first
  if (mainTaskNodes.length > 0) {
    layoutNodes.push(...layoutMainTaskNodes(mainTaskNodes, layoutConfig));
  }

  // Position subtask nodes relative to main task
  if (subtaskNodes.length > 0) {
    const mainTaskPosition = mainTaskNodes[0]?.position || { x: 250, y: 100 };
    layoutNodes.push(...layoutSubtaskNodes(subtaskNodes, mainTaskPosition, layoutConfig));
  }

  // Position guide nodes relative to their associated subtasks
  if (guideNodes.length > 0) {
    layoutNodes.push(...layoutGuideNodes(guideNodes, layoutNodes, layoutConfig));
  }

  // Position other nodes
  if (otherNodes.length > 0) {
    layoutNodes.push(...layoutOtherNodes(otherNodes, layoutNodes, layoutConfig));
  }

  return layoutNodes;
}

/**
 * Layout main task nodes (usually just one, centered)
 */
function layoutMainTaskNodes(
  nodes: CanvasNode[], 
  config: LayoutConfig
): CanvasNode[] {
  if (nodes.length === 1) {
    return [{
      ...nodes[0],
      position: { x: 250, y: 100 }
    }];
  }

  // Multiple main tasks - arrange horizontally
  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: 250 + index * (config.nodeSpacing.x + 100),
      y: 100
    }
  }));
}

/**
 * Layout subtask nodes in relation to main task
 */
function layoutSubtaskNodes(
  nodes: CanvasNode[], 
  mainTaskPosition: { x: number; y: number },
  config: LayoutConfig
): CanvasNode[] {
  switch (config.direction) {
    case 'vertical':
      return layoutVertical(nodes, mainTaskPosition, config);
    case 'horizontal':
      return layoutHorizontal(nodes, mainTaskPosition, config);
    case 'circular':
      return layoutCircular(nodes, mainTaskPosition, config);
    case 'hierarchical':
      return layoutHierarchical(nodes, mainTaskPosition, config);
    case 'grid':
    default:
      return layoutGrid(nodes, mainTaskPosition, config);
  }
}

/**
 * Grid layout - arranges nodes in a grid pattern
 */
function layoutGrid(
  nodes: CanvasNode[], 
  startPosition: { x: number; y: number },
  config: LayoutConfig
): CanvasNode[] {
  const columns = Math.ceil(Math.sqrt(nodes.length));
  const startY = startPosition.y + config.nodeSpacing.y;

  return nodes.map((node, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    
    // Center the grid horizontally relative to main task
    const totalWidth = columns * config.nodeSpacing.x;
    const startX = startPosition.x - totalWidth / 2 + config.nodeSpacing.x / 2;

    return {
      ...node,
      position: {
        x: startX + col * config.nodeSpacing.x,
        y: startY + row * config.nodeSpacing.y
      }
    };
  });
}

/**
 * Vertical layout - stacks nodes vertically
 */
function layoutVertical(
  nodes: CanvasNode[], 
  startPosition: { x: number; y: number },
  config: LayoutConfig
): CanvasNode[] {
  const startY = startPosition.y + config.nodeSpacing.y;

  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: startPosition.x,
      y: startY + index * config.nodeSpacing.y
    }
  }));
}

/**
 * Horizontal layout - arranges nodes horizontally
 */
function layoutHorizontal(
  nodes: CanvasNode[], 
  startPosition: { x: number; y: number },
  config: LayoutConfig
): CanvasNode[] {
  const startY = startPosition.y + config.nodeSpacing.y;
  const totalWidth = nodes.length * config.nodeSpacing.x;
  const startX = startPosition.x - totalWidth / 2 + config.nodeSpacing.x / 2;

  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: startX + index * config.nodeSpacing.x,
      y: startY
    }
  }));
}

/**
 * Circular layout - arranges nodes in a circle
 */
function layoutCircular(
  nodes: CanvasNode[], 
  center: { x: number; y: number },
  config: LayoutConfig
): CanvasNode[] {
  const radius = Math.max(200, nodes.length * 30);
  const centerY = center.y + config.nodeSpacing.y;

  return nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2;
    return {
      ...node,
      position: {
        x: center.x + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      }
    };
  });
}

/**
 * Hierarchical layout - organizes nodes by priority/status
 */
function layoutHierarchical(
  nodes: CanvasNode[], 
  startPosition: { x: number; y: number },
  config: LayoutConfig
): CanvasNode[] {
  // Group nodes by status or priority
  const priorityNodes: CanvasNode[] = [];
  const regularNodes: CanvasNode[] = [];
  const completedNodes: CanvasNode[] = [];

  nodes.forEach(node => {
    if (isSubtaskNodeData(node.data)) {
      switch (node.data.status) {
        case 'recommended':
        case 'generating_guide':
        case 'guide_generated':
          priorityNodes.push(node);
          break;
        case 'error':
          completedNodes.push(node);
          break;
        default:
          regularNodes.push(node);
      }
    } else {
      regularNodes.push(node);
    }
  });

  const result: CanvasNode[] = [];
  let currentY = startPosition.y + config.nodeSpacing.y;

  // Layout priority nodes first
  if (priorityNodes.length > 0) {
    result.push(...layoutHorizontal(priorityNodes, 
      { x: startPosition.x, y: currentY }, config));
    currentY += config.nodeSpacing.y;
  }

  // Layout regular nodes
  if (regularNodes.length > 0) {
    result.push(...layoutGrid(regularNodes, 
      { x: startPosition.x, y: currentY }, config));
    currentY += Math.ceil(regularNodes.length / Math.ceil(Math.sqrt(regularNodes.length))) * config.nodeSpacing.y;
  }

  // Layout completed/error nodes at bottom
  if (completedNodes.length > 0) {
    result.push(...layoutHorizontal(completedNodes, 
      { x: startPosition.x, y: currentY }, config));
  }

  return result;
}

/**
 * Layout guide nodes relative to their associated subtask nodes
 */
function layoutGuideNodes(
  guideNodes: CanvasNode[], 
  existingNodes: CanvasNode[],
  config: LayoutConfig
): CanvasNode[] {
  return guideNodes.map(guideNode => {
    // Find the associated subtask node
    const associatedNode = existingNodes.find(node => 
      node.type === CanvasNodeType.SUBTASK && 
      isSubtaskNodeData(node.data) &&
      node.data.connectedGuideId === guideNode.id
    );

    if (associatedNode) {
      // Position guide below and slightly to the right of subtask
      return {
        ...guideNode,
        position: {
          x: associatedNode.position.x + 50,
          y: associatedNode.position.y + 250
        }
      };
    }

    // Default position if no associated node found
    return {
      ...guideNode,
      position: findAvailablePosition(existingNodes, config)
    };
  });
}

/**
 * Layout other nodes (shapes, text) in available spaces
 */
function layoutOtherNodes(
  otherNodes: CanvasNode[], 
  existingNodes: CanvasNode[],
  config: LayoutConfig
): CanvasNode[] {
  return otherNodes.map(node => ({
    ...node,
    position: findAvailablePosition([...existingNodes], config)
  }));
}

/**
 * Find an available position that doesn't overlap with existing nodes
 */
function findAvailablePosition(
  existingNodes: CanvasNode[], 
  config: LayoutConfig
): { x: number; y: number } {
  const occupiedPositions = existingNodes.map(node => node.position);
  const minDistance = Math.max(config.nodeSpacing.x, config.nodeSpacing.y) * 0.8;

  let x = config.padding.x;
  let y = 500; // Start below typical subtask area

  while (true) {
    const tooClose = occupiedPositions.some(pos => 
      Math.sqrt(Math.pow(pos.x - x, 2) + Math.pow(pos.y - y, 2)) < minDistance
    );

    if (!tooClose) {
      return { x, y };
    }

    x += config.nodeSpacing.x;
    if (x > 1200) {
      x = config.padding.x;
      y += config.nodeSpacing.y;
    }
  }
}

/**
 * Optimize layout to minimize edge crossings
 */
export function optimizeEdgeCrossings(
  nodes: CanvasNode[], 
  edges: Array<{ source: string; target: string }>
): CanvasNode[] {
  // This is a simplified version - a full implementation would use
  // algorithms like force-directed layout or simulated annealing
  
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const result = [...nodes];

  // For each edge, try to minimize distance between connected nodes
  edges.forEach(edge => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    
    if (sourceNode && targetNode) {
      const sourceIndex = result.findIndex(n => n.id === edge.source);
      const targetIndex = result.findIndex(n => n.id === edge.target);
      
      if (sourceIndex !== -1 && targetIndex !== -1) {
        // Simple optimization: move target closer to source if possible
        const distance = Math.sqrt(
          Math.pow(sourceNode.position.x - targetNode.position.x, 2) +
          Math.pow(sourceNode.position.y - targetNode.position.y, 2)
        );
        
        // Only adjust if nodes are far apart and there's room
        if (distance > 400) {
          const angle = Math.atan2(
            targetNode.position.y - sourceNode.position.y,
            targetNode.position.x - sourceNode.position.x
          );
          
          const newTargetPosition = {
            x: sourceNode.position.x + 300 * Math.cos(angle),
            y: sourceNode.position.y + 300 * Math.sin(angle)
          };
          
          // Check if new position conflicts with other nodes
          const conflicts = result.some(node => 
            node.id !== edge.target &&
            Math.sqrt(
              Math.pow(node.position.x - newTargetPosition.x, 2) +
              Math.pow(node.position.y - newTargetPosition.y, 2)
            ) < 200
          );
          
          if (!conflicts) {
            result[targetIndex] = {
              ...result[targetIndex],
              position: newTargetPosition
            };
          }
        }
      }
    }
  });

  return result;
}

/**
 * Smart layout that analyzes the workflow structure
 */
export function smartLayout(
  nodes: CanvasNode[],
  edges: Array<{ source: string; target: string }> = []
): CanvasNode[] {
  // Start with basic auto-layout
  let layoutedNodes = autoLayoutNodes(nodes, { 
    direction: 'grid',
    centerOnMainTask: true 
  });

  // If there are edges, optimize for fewer crossings
  if (edges.length > 0) {
    layoutedNodes = optimizeEdgeCrossings(layoutedNodes, edges);
  }

  // Final pass: ensure no overlapping nodes
  layoutedNodes = resolveOverlaps(layoutedNodes);

  return layoutedNodes;
}

/**
 * Resolve any overlapping nodes by adjusting positions
 */
function resolveOverlaps(nodes: CanvasNode[]): CanvasNode[] {
  const result = [...nodes];
  const minDistance = 150; // Minimum distance between node centers

  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const nodeA = result[i];
      const nodeB = result[j];
      
      const distance = Math.sqrt(
        Math.pow(nodeA.position.x - nodeB.position.x, 2) +
        Math.pow(nodeA.position.y - nodeB.position.y, 2)
      );
      
      if (distance < minDistance) {
        // Move nodeB away from nodeA
        const angle = Math.atan2(
          nodeB.position.y - nodeA.position.y,
          nodeB.position.x - nodeA.position.x
        );
        
        result[j] = {
          ...nodeB,
          position: {
            x: nodeA.position.x + minDistance * Math.cos(angle),
            y: nodeA.position.y + minDistance * Math.sin(angle)
          }
        };
      }
    }
  }

  return result;
}

/**
 * Calculate bounds of all nodes for viewport fitting
 */
export function calculateNodeBounds(nodes: CanvasNode[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 500, height: 300 };
  }

  const positions = nodes.map(node => node.position);
  const minX = Math.min(...positions.map(p => p.x)) - 100;
  const maxX = Math.max(...positions.map(p => p.x)) + 300;
  const minY = Math.min(...positions.map(p => p.y)) - 50;
  const maxY = Math.max(...positions.map(p => p.y)) + 200;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}