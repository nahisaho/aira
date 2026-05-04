import { useState } from 'react';
import { ResizablePanel } from './components/ResizablePanel';
import { Sidebar } from './components/project/Sidebar';
import { ChatPane } from './components/chat/ChatPane';
import { RightPanel } from './components/files/RightPanel';
import { usePreferencesStore } from './stores/preferences';

export function App() {
  const theme = usePreferencesStore((s) => s.theme);

  const [leftCollapsed, setLeftCollapsed] = useState(() =>
    localStorage.getItem('aira-left-collapsed') === 'true',
  );
  const [rightCollapsed, setRightCollapsed] = useState(() =>
    localStorage.getItem('aira-right-collapsed') === 'true',
  );

  const toggleLeft = () => {
    const next = !leftCollapsed;
    setLeftCollapsed(next);
    localStorage.setItem('aira-left-collapsed', String(next));
  };

  const toggleRight = () => {
    const next = !rightCollapsed;
    setRightCollapsed(next);
    localStorage.setItem('aira-right-collapsed', String(next));
  };

  return (
    <div
      data-testid="app-root"
      className={`flex h-screen ${
        theme === 'light'
          ? 'bg-gray-50 text-gray-900'
          : 'bg-gray-900 text-gray-100'
      }`}
    >
      {/* Left Sidebar */}
      <ResizablePanel
        side="left"
        defaultWidth={240}
        minWidth={200}
        maxWidth={400}
        storageKey="aira-sidebar-width"
        collapsed={leftCollapsed}
      >
        <Sidebar />
      </ResizablePanel>

      {/* Center - Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toggle buttons */}
        <div className={`flex items-center gap-1 px-2 py-1 border-b ${
          theme === 'light' ? 'border-gray-200' : 'border-gray-700'
        }`}>
          <button
            onClick={toggleLeft}
            className={`text-xs px-1 ${
              theme === 'light'
                ? 'text-gray-500 hover:text-gray-800'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title={leftCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            {leftCollapsed ? '☰' : '◁'}
          </button>
          <div className="flex-1" />
          <button
            onClick={toggleRight}
            className={`text-xs px-1 ${
              theme === 'light'
                ? 'text-gray-500 hover:text-gray-800'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title={rightCollapsed ? 'Show panel' : 'Hide panel'}
          >
            {rightCollapsed ? '▷' : '▷'}
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <ChatPane />
        </div>
      </div>
      <ResizablePanel
        side="right"
        defaultWidth={320}
        minWidth={200}
        maxWidth={600}
        storageKey="aira-panel-width"
        collapsed={rightCollapsed}
      >
        <RightPanel />
      </ResizablePanel>
    </div>
  );
}
