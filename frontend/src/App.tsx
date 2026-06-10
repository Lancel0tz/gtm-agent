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

function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [gameInput, setGameInput] = useState<GameInput | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch('/api/input').then(r => r.json()).then(setGameInput);
    fetch('/api/modules').then(r => r.json()).then((modules) => {
      setState(prev => {
        const next = { ...prev };
        for (const key of Object.keys(modules) as ModuleName[]) {
          if (modules[key]) {
            next[key] = { status: 'done', data: modules[key] };
          }
        }
        return next;
      });
    });
  }, []);

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
          [event.module]: { status: 'done', data: event.data },
        }));
      }
    };
    return () => es.close();
  }, []);

  const handleSend = useCallback(async (message: string) => {
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();

      if (data.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      }

      for (const event of data.events || []) {
        if (event.type === 'module_update') {
          setState(prev => ({
            ...prev,
            [event.module]: { status: 'done', data: event.data },
          }));
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error communicating with the server.' }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
          <InputPanel input={gameInput} />
        </div>

        {/* Middle: Canvas */}
        <div className="flex-1 overflow-y-auto min-w-0">
          <Canvas state={state} />
        </div>

        {/* Right: Chat */}
        <div className="w-96 shrink-0 border-l border-gray-200 flex flex-col min-h-0">
          <ChatPanel messages={messages} onSend={handleSend} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}

export default App;
