import { useState, useCallback, useRef } from 'react';
import { usePreferencesStore } from '../stores/preferences';

interface ResizablePanelProps {
  side: 'left' | 'right';
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey: string;
  collapsed?: boolean;
  children: React.ReactNode;
}

export function ResizablePanel({
  side,
  defaultWidth,
  minWidth,
  maxWidth,
  storageKey,
  collapsed = false,
  children,
}: ResizablePanelProps) {
  const theme = usePreferencesStore((s) => s.theme);
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored ? parseInt(stored, 10) : defaultWidth;
  });
  const isDragging = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;

      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = side === 'left' ? e.clientX - startX : startX - e.clientX;
        const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + delta));
        setWidth(newWidth);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          localStorage.setItem(storageKey, String(newWidth));
        }, 300);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [width, side, minWidth, maxWidth, storageKey],
  );

  if (collapsed) return null;

  const handle = (
    <div
      className={`w-1 cursor-col-resize transition-colors ${
        theme === 'light'
          ? 'bg-gray-200 hover:bg-blue-400'
          : 'bg-gray-700 hover:bg-blue-500'
      } ${side === 'left' ? 'order-last' : 'order-first'}`}
      onMouseDown={handleMouseDown}
    />
  );

  return (
    <div className="flex flex-shrink-0" style={{ width }}>
      {side === 'right' && handle}
      <div className="flex-1 overflow-hidden">{children}</div>
      {side === 'left' && handle}
    </div>
  );
}
