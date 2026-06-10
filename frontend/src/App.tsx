import { useState, useEffect, useCallback } from 'react';
import { InputPanel } from './components/InputPanel';
import { Canvas } from './components/Canvas';
import { ChatPanel } from './components/ChatPanel';
import type { AppState, GameInput, ChatMessage, ModuleName } from './types';

const INITIAL_STATE: AppState = {
  competitiveLandscape: { status: 'idle', data: null },
  audienceOverview: { status: 'idle', data: null },
  positioningMatrix: { status: 'idle', data: null },
  swot: { status: 'idle', data: null },
};

export interface ThreadSummary {
  id: string;
  title: string;
  brief: string;
  updated: number;
}

function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [gameInput, setGameInput] = useState<GameInput | null>(null);
  const [inputFiles, setInputFiles] = useState<string[]>([]);
  const [activeInput, setActiveInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [quote, setQuote] = useState<string | null>(null);

  const loadInput = useCallback(() => {
    fetch('/api/input').then(r => r.json()).then(setGameInput);
    fetch('/api/inputs').then(r => r.json()).then((d) => {
      setInputFiles(d.files);
      setActiveInput(d.active);
    });
  }, []);

  const loadModules = useCallback(() => {
    fetch('/api/modules').then(r => r.json()).then((modules) => {
      setState(() => {
        const next = { ...INITIAL_STATE };
        for (const key of Object.keys(modules) as ModuleName[]) {
          if (modules[key]?.data) {
            next[key] = { status: 'done', data: modules[key].data, changes: modules[key].changes };
          }
        }
        return next;
      });
    });
  }, []);

  useEffect(() => {
    loadInput();
    loadModules();
  }, [loadInput, loadModules]);

  useEffect(() => {
    const es = new EventSource('/api/events');
    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === 'status') {
        setState(prev => ({
          ...prev,
          [event.module]: { ...prev[event.module as ModuleName], status: event.status },
        }));
      } else if (event.type === 'module_update') {
        setState(prev => ({
          ...prev,
          [event.module]: { status: 'done', data: event.data, changes: event.changes ?? null },
        }));
      } else if (event.type === 'input_changed') {
        loadInput();
        loadModules();
      }
    };
    return () => es.close();
  }, [loadInput, loadModules]);

  const loadThreads = useCallback(async (): Promise<ThreadSummary[]> => {
    const d = await fetch('/api/threads').then(r => r.json());
    setThreads(d.threads);
    return d.threads;
  }, []);

  const handleSelectThread = useCallback(async (tid: string) => {
    const d = await fetch(`/api/threads/${tid}/select`, { method: 'POST' }).then(r => r.json());
    setActiveThread(tid);
    setMessages(d.messages);
    // The thread may belong to a different brief — refresh everything
    loadInput();
    loadModules();
  }, [loadInput, loadModules]);

  const handleNewThread = useCallback(async () => {
    const d = await fetch('/api/threads', { method: 'POST' }).then(r => r.json());
    setActiveThread(d.id);
    setMessages([]);
    loadThreads();
  }, [loadThreads]);

  const handleDeleteThread = useCallback(async (tid: string) => {
    await fetch(`/api/threads/${tid}`, { method: 'DELETE' });
    const remaining = await loadThreads();
    if (tid === activeThread) {
      setActiveThread(null);
      setMessages([]);
      if (remaining.length > 0) handleSelectThread(remaining[0].id);
    }
  }, [activeThread, loadThreads, handleSelectThread]);

  const handleRegenerate = useCallback(async () => {
    if (!activeThread || isLoading) return;
    setIsLoading(true);
    // Optimistically drop the last assistant reply
    setMessages(prev => {
      const idx = prev.map(m => m.role).lastIndexOf('assistant');
      return idx >= 0 ? prev.slice(0, idx) : prev;
    });
    try {
      const d = await fetch(`/api/threads/${activeThread}/regenerate`, { method: 'POST' }).then(r => r.json());
      if (d.messages) setMessages(d.messages);
      loadThreads();
    } finally {
      setIsLoading(false);
    }
  }, [activeThread, isLoading, loadThreads]);

  const handleStop = useCallback(async () => {
    await fetch('/api/chat/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread_id: activeThread }),
    });
    // The pending /api/chat request resolves with the stopped response
  }, [activeThread]);

  const handleRenameThread = useCallback(async (tid: string, title: string) => {
    await fetch(`/api/threads/${tid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    loadThreads();
  }, [loadThreads]);

  const handleEditMessage = useCallback(async (index: number, message: string) => {
    if (!activeThread || isLoading) return;
    setIsLoading(true);
    // Optimistically truncate at the edited message and show it
    setMessages(prev => [...prev.slice(0, index), { role: 'user', content: message }]);
    try {
      const d = await fetch(`/api/threads/${activeThread}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index, message }),
      }).then(r => r.json());
      if (d.messages) setMessages(d.messages);
      loadThreads();
    } finally {
      setIsLoading(false);
    }
  }, [activeThread, isLoading, loadThreads]);

  const handleUndo = useCallback(async () => {
    if (!activeThread || isLoading) return;
    const d = await fetch(`/api/threads/${activeThread}/undo`, { method: 'POST' }).then(r => r.json());
    if (d.messages) setMessages(d.messages);
    loadThreads();
    // Restored module states arrive via SSE module_update events
  }, [activeThread, isLoading, loadThreads]);

  // Restore the last active thread on page load
  useEffect(() => {
    fetch('/api/threads').then(r => r.json()).then((d) => {
      setThreads(d.threads);
      if (d.active) {
        const t = d.threads.find((x: ThreadSummary) => x.id === d.active);
        if (t) {
          setActiveThread(d.active);
          fetch(`/api/threads/${d.active}/select`, { method: 'POST' })
            .then(r => r.json())
            .then((td) => setMessages(td.messages));
        }
      }
    });
  }, []);

  const handleSwitchInput = useCallback(async (filename: string) => {
    await fetch('/api/inputs/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    });
    loadInput();
    loadModules();
    // Continue this brief's most recent thread, or start a fresh one
    const all = await loadThreads();
    const existing = all.find((t) => t.brief === filename);
    if (existing) {
      handleSelectThread(existing.id);
    } else {
      handleNewThread();
    }
  }, [loadInput, loadModules, loadThreads, handleSelectThread, handleNewThread]);

  const handleSend = useCallback(async (message: string) => {
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, thread_id: activeThread }),
      });
      const data = await res.json();

      if (data.thread_id) setActiveThread(data.thread_id);
      if (data.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      }
      loadThreads();

      for (const event of data.events || []) {
        if (event.type === 'module_update') {
          setState(prev => ({
            ...prev,
            [event.module]: { status: 'done', data: event.data, changes: event.changes ?? null },
          }));
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error communicating with the server.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [activeThread, loadThreads]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-black rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">G</span>
          </div>
          <span className="font-semibold text-sm text-gray-900">GTM Agent</span>
        </div>
        <span className="text-xs text-gray-400">Go-To-Market Analysis</span>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Input Panel */}
        <div className="w-64 shrink-0 border-r border-gray-200 overflow-y-auto">
          <InputPanel
            input={gameInput}
            files={inputFiles}
            active={activeInput}
            onSwitch={handleSwitchInput}
          />
        </div>

        {/* Middle: Canvas */}
        <div className="flex-1 overflow-y-auto min-w-0">
          <Canvas state={state} onQuote={setQuote} />
        </div>

        {/* Right: Chat */}
        <div className="w-96 shrink-0 border-l border-gray-200 flex flex-col min-h-0">
          <ChatPanel
            messages={messages}
            onSend={handleSend}
            isLoading={isLoading}
            modules={state}
            threads={threads}
            activeThread={activeThread}
            onSelectThread={handleSelectThread}
            onNewThread={handleNewThread}
            onDeleteThread={handleDeleteThread}
            onRegenerate={handleRegenerate}
            onUndo={handleUndo}
            onRenameThread={handleRenameThread}
            onEditMessage={handleEditMessage}
            quote={quote}
            onClearQuote={() => setQuote(null)}
            onStop={handleStop}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
