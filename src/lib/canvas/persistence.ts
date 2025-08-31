import { 
  CanvasNode, 
  CanvasEdge, 
  CanvasConfig,
  CanvasHistoryEntry 
} from '@/types/canvas';

/**
 * Canvas state persistence utilities
 */

interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: { x: number; y: number; zoom: number };
  config: CanvasConfig;
  metadata: {
    version: string;
    timestamp: Date;
    userAgent: string;
  };
}

interface CanvasExport extends CanvasState {
  history?: CanvasHistoryEntry[];
}

const STORAGE_KEY = 'flowgenius-canvas-state';
const BACKUP_STORAGE_KEY = 'flowgenius-canvas-backup';
const CURRENT_VERSION = '1.0.0';

/**
 * Save canvas state to localStorage
 */
export function saveCanvasToStorage(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  viewport: { x: number; y: number; zoom: number },
  config: CanvasConfig
): boolean {
  try {
    const canvasState: CanvasState = {
      nodes,
      edges,
      viewport,
      config,
      metadata: {
        version: CURRENT_VERSION,
        timestamp: new Date(),
        userAgent: navigator.userAgent
      }
    };

    // Create backup of existing state
    const existingState = localStorage.getItem(STORAGE_KEY);
    if (existingState) {
      localStorage.setItem(BACKUP_STORAGE_KEY, existingState);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(canvasState));
    return true;
  } catch (error) {
    console.error('Failed to save canvas state:', error);
    return false;
  }
}

/**
 * Load canvas state from localStorage
 */
export function loadCanvasFromStorage(): CanvasState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const canvasState: CanvasState = JSON.parse(stored);
    
    // Validate version compatibility
    if (!isVersionCompatible(canvasState.metadata?.version)) {
      console.warn('Canvas state version is incompatible, migrating...');
      return migrateCanvasState(canvasState);
    }

    return canvasState;
  } catch (error) {
    console.error('Failed to load canvas state:', error);
    
    // Try to load backup
    try {
      const backup = localStorage.getItem(BACKUP_STORAGE_KEY);
      if (backup) {
        const backupState: CanvasState = JSON.parse(backup);
        console.log('Restored from backup');
        return backupState;
      }
    } catch (backupError) {
      console.error('Backup also failed to load:', backupError);
    }
    
    return null;
  }
}

/**
 * Export canvas state as downloadable file
 */
export function exportCanvasAsFile(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  viewport: { x: number; y: number; zoom: number },
  config: CanvasConfig,
  history?: CanvasHistoryEntry[]
): void {
  const canvasExport: CanvasExport = {
    nodes,
    edges,
    viewport,
    config,
    history,
    metadata: {
      version: CURRENT_VERSION,
      timestamp: new Date(),
      userAgent: navigator.userAgent
    }
  };

  const dataStr = JSON.stringify(canvasExport, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `flowgenius-canvas-${new Date().toISOString().split('T')[0]}.json`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import canvas state from uploaded file
 */
export function importCanvasFromFile(file: File): Promise<CanvasExport | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const canvasData: CanvasExport = JSON.parse(content);
        
        // Validate the imported data
        if (!validateCanvasData(canvasData)) {
          console.error('Invalid canvas data format');
          resolve(null);
          return;
        }
        
        // Migrate if necessary
        const migratedData = isVersionCompatible(canvasData.metadata?.version) 
          ? canvasData 
          : migrateCanvasState(canvasData);
          
        resolve(migratedData);
      } catch (error) {
        console.error('Failed to parse canvas file:', error);
        resolve(null);
      }
    };
    
    reader.onerror = () => {
      console.error('Failed to read canvas file');
      resolve(null);
    };
    
    reader.readAsText(file);
  });
}

/**
 * Auto-save functionality
 */
export class CanvasAutoSave {
  private saveInterval: NodeJS.Timeout | null = null;
  private isDirty = false;
  private isEnabled = false;
  
  constructor(private interval: number = 30000) {} // 30 seconds default
  
  start(saveCallback: () => void): void {
    if (this.isEnabled) return;
    
    this.isEnabled = true;
    this.saveInterval = setInterval(() => {
      if (this.isDirty) {
        saveCallback();
        this.isDirty = false;
        console.log('Auto-saved canvas state');
      }
    }, this.interval);
  }
  
  stop(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
    this.isEnabled = false;
  }
  
  markDirty(): void {
    this.isDirty = true;
  }
  
  forceSave(saveCallback: () => void): void {
    saveCallback();
    this.isDirty = false;
  }
}

/**
 * Create shareable canvas link
 */
export function createShareableLink(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  config: CanvasConfig
): string {
  const canvasData: Partial<CanvasState> = {
    nodes,
    edges,
    config,
    metadata: {
      version: CURRENT_VERSION,
      timestamp: new Date(),
      userAgent: navigator.userAgent
    }
  };

  // Compress and encode the data
  const compressed = compressCanvasData(canvasData);
  const encoded = btoa(compressed);
  
  // Create shareable URL
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?canvas=${encodeURIComponent(encoded)}`;
}

/**
 * Load canvas from shareable link
 */
export function loadFromShareableLink(url: string): CanvasState | null {
  try {
    const urlObj = new URL(url);
    const canvasParam = urlObj.searchParams.get('canvas');
    
    if (!canvasParam) return null;
    
    const decoded = atob(decodeURIComponent(canvasParam));
    const canvasData = decompressCanvasData(decoded);
    
    if (!validateCanvasData(canvasData)) {
      console.error('Invalid shared canvas data');
      return null;
    }
    
    return canvasData as CanvasState;
  } catch (error) {
    console.error('Failed to load from shareable link:', error);
    return null;
  }
}

/**
 * Validate canvas data structure
 */
function validateCanvasData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  
  // Check required fields
  if (!Array.isArray(data.nodes)) return false;
  if (!Array.isArray(data.edges)) return false;
  if (!data.metadata || !data.metadata.version) return false;
  
  // Validate nodes structure
  for (const node of data.nodes) {
    if (!node.id || !node.type || !node.position || !node.data) {
      return false;
    }
  }
  
  // Validate edges structure
  for (const edge of data.edges) {
    if (!edge.id || !edge.source || !edge.target) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check version compatibility
 */
function isVersionCompatible(version?: string): boolean {
  if (!version) return false;
  
  const [major] = version.split('.').map(Number);
  const [currentMajor] = CURRENT_VERSION.split('.').map(Number);
  
  return major === currentMajor;
}

/**
 * Migrate canvas state to current version
 */
function migrateCanvasState(oldState: any): CanvasState {
  // Create a new state with current version
  const migratedState: CanvasState = {
    nodes: oldState.nodes || [],
    edges: oldState.edges || [],
    viewport: oldState.viewport || { x: 0, y: 0, zoom: 1 },
    config: oldState.config || {},
    metadata: {
      version: CURRENT_VERSION,
      timestamp: new Date(),
      userAgent: navigator.userAgent
    }
  };

  // Apply specific migrations based on old version
  // This is where you would add version-specific migration logic
  
  return migratedState;
}

/**
 * Simple compression for canvas data
 */
function compressCanvasData(data: any): string {
  // This is a placeholder - in a real implementation you might use
  // libraries like pako for gzip compression
  return JSON.stringify(data);
}

/**
 * Decompress canvas data
 */
function decompressCanvasData(compressed: string): any {
  // This is a placeholder - would decompress if compression was used
  return JSON.parse(compressed);
}

/**
 * Clear all stored canvas data
 */
export function clearStoredCanvasData(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(BACKUP_STORAGE_KEY);
}

/**
 * Get storage usage information
 */
export function getStorageInfo(): {
  isSupported: boolean;
  used: number;
  available: number;
  canvasStateSize: number;
} {
  const isSupported = typeof Storage !== 'undefined';
  
  if (!isSupported) {
    return {
      isSupported: false,
      used: 0,
      available: 0,
      canvasStateSize: 0
    };
  }

  let used = 0;
  let canvasStateSize = 0;
  
  try {
    // Calculate total usage
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage.getItem(key)?.length || 0;
      }
    }
    
    // Get canvas-specific size
    const canvasState = localStorage.getItem(STORAGE_KEY);
    canvasStateSize = canvasState?.length || 0;
    
  } catch (error) {
    console.error('Failed to calculate storage usage:', error);
  }

  return {
    isSupported: true,
    used,
    available: 5 * 1024 * 1024 - used, // Assuming 5MB limit
    canvasStateSize
  };
}

/**
 * Batch operations for handling multiple canvas states
 */
export class CanvasStateManager {
  private states: Map<string, CanvasState> = new Map();
  
  saveState(id: string, state: CanvasState): void {
    this.states.set(id, { ...state });
  }
  
  loadState(id: string): CanvasState | null {
    return this.states.get(id) || null;
  }
  
  deleteState(id: string): boolean {
    return this.states.delete(id);
  }
  
  getAllStates(): { id: string; state: CanvasState }[] {
    return Array.from(this.states.entries()).map(([id, state]) => ({ id, state }));
  }
  
  exportAllStates(): string {
    const allStates = Object.fromEntries(this.states);
    return JSON.stringify(allStates, null, 2);
  }
  
  importAllStates(data: string): boolean {
    try {
      const allStates = JSON.parse(data);
      this.states.clear();
      
      for (const [id, state] of Object.entries(allStates)) {
        if (validateCanvasData(state)) {
          this.states.set(id, state as CanvasState);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to import states:', error);
      return false;
    }
  }
}