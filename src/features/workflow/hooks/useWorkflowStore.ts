import { create } from "zustand";
import { WorkflowResponse } from "@/types/workflow";

interface WorkflowState {
  workflowResult: WorkflowResponse | null;
  isLoading: boolean;
  setWorkflowResult: (result: WorkflowResponse | null) => void;
  setIsLoading: (loading: boolean) => void;
  clearWorkflow: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflowResult: null,
  isLoading: false,
  setWorkflowResult: (result) => set({ workflowResult: result }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  clearWorkflow: () => set({ workflowResult: null, isLoading: false }),
}));
