export function App() {
  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      <aside className="w-60 border-r border-gray-700 p-4">
        <h1 className="text-xl font-bold">AIRA</h1>
        <p className="text-sm text-gray-400 mt-1">AI Runway Application</p>
      </aside>
      <main className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Select or create a project to begin</p>
      </main>
      <aside className="w-80 border-l border-gray-700 p-4">
        <p className="text-sm text-gray-400">Progress &amp; Files</p>
      </aside>
    </div>
  );
}
