import { create } from 'zustand';
import { wsClient } from '../api/ws';

export interface PipelineStep {
  label: string;
  status: 'pending' | 'running' | 'done';
}

interface PipelineStore {
  steps: PipelineStep[];
  currentStep: number; // -1 = not started
  reset: () => void;
}

export const usePipelineStore = create<PipelineStore>((set) => ({
  steps: [],
  currentStep: -1,
  reset: () => set({ steps: [], currentStep: -1 }),
}));

// Build pipeline from progress events (tool executions, turn starts)
wsClient.onEvent((event) => {
  switch (event.type) {
    case 'progress': {
      const label = event.message;
      if (!label) break;

      const { steps } = usePipelineStore.getState();

      // Skip duplicates
      if (steps.length > 0 && steps[steps.length - 1]!.label === label) break;

      // Mark previous running step as done, add new one as running
      const updated = steps.map(s =>
        s.status === 'running' ? { ...s, status: 'done' as const } : s,
      );
      updated.push({ label, status: 'running' });

      // Keep only last 20 steps to avoid unbounded growth
      const trimmed = updated.length > 20 ? updated.slice(-20) : updated;
      usePipelineStore.setState({
        steps: trimmed,
        currentStep: trimmed.length - 1,
      });
      break;
    }
    case 'status':
      if (event.status === 'running') {
        usePipelineStore.setState({ steps: [], currentStep: -1 });
      } else if (event.status === 'completed' || event.status === 'failed') {
        const { steps } = usePipelineStore.getState();
        if (steps.length > 0) {
          usePipelineStore.setState({
            steps: steps.map(s => ({ ...s, status: 'done' as const })),
            currentStep: steps.length - 1,
          });
        }
      }
      break;
  }
});
