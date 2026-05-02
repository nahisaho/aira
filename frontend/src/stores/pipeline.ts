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

/**
 * Extract pipeline steps from assistant message content.
 * Matches patterns like:
 *   Step 1: Description
 *   ## 1. Description
 *   1. Description (numbered list at start)
 */
function extractSteps(content: string): string[] {
  const lines = content.split('\n');
  const steps: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match "Step N: ..." or "Step N. ..."
    const stepMatch = trimmed.match(/^(?:Step\s+)?(\d+)[.:]\s*(.+)/i);
    if (stepMatch && stepMatch[2]) {
      const label = stepMatch[2].replace(/\*\*/g, '').trim();
      if (label.length > 2 && label.length < 100) {
        steps.push(label);
      }
    }
    // Match "## N. Description" (markdown headers with numbers)
    const headerMatch = trimmed.match(/^#{1,3}\s+(?:Step\s+)?\d+[.:]\s*(.+)/i);
    if (headerMatch && headerMatch[1]) {
      const label = headerMatch[1].replace(/\*\*/g, '').trim();
      if (label.length > 2 && label.length < 100 && !steps.includes(label)) {
        steps.push(label);
      }
    }
  }

  return steps;
}

/**
 * Determine which step is currently active based on content.
 * A step is "done" if content after it contains a subsequent step header.
 */
function computeProgress(steps: string[], content: string): PipelineStep[] {
  if (steps.length === 0) return [];

  // Find last step that appears in content
  let lastFound = -1;
  for (let i = 0; i < steps.length; i++) {
    // Check if the step's keyword appears in content (rough heuristic)
    const keywords = steps[i]!.slice(0, 30);
    if (content.includes(keywords)) {
      lastFound = i;
    }
  }

  return steps.map((label, i) => ({
    label,
    status: i < lastFound ? 'done' : i === lastFound ? 'running' : 'pending',
  }));
}

export const usePipelineStore = create<PipelineStore>((set) => ({
  steps: [],
  currentStep: -1,
  reset: () => set({ steps: [], currentStep: -1 }),
}));

// Accumulate streaming content to extract pipeline
let streamBuffer = '';

wsClient.onEvent((event) => {
  switch (event.type) {
    case 'chunk': {
      streamBuffer += event.content;
      const steps = extractSteps(streamBuffer);
      if (steps.length >= 2) {
        const pipelineSteps = computeProgress(steps, streamBuffer);
        const currentStep = pipelineSteps.findLastIndex(s => s.status !== 'pending');
        usePipelineStore.setState({ steps: pipelineSteps, currentStep });
      }
      break;
    }
    case 'status':
      if (event.status === 'running') {
        streamBuffer = '';
        usePipelineStore.setState({ steps: [], currentStep: -1 });
      } else if (event.status === 'completed' || event.status === 'failed') {
        // Mark all as done on completion
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
