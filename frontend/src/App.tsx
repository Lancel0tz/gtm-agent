import { useState, useEffect, useCallback } from 'react';
import { InputPanel } from './components/InputPanel';
import { Canvas } from './components/Canvas';
import { ChatPanel } from './components/ChatPanel';
import { SettingsModal } from './components/SettingsModal';
import type { ProviderInfo } from './components/SettingsModal';
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
  const [streamingText, setStreamingText] = useState('');
  // Previous generation of the positioning matrix (all lenses) — powers
  // the green(added)/red(removed) dots on every view of the chart
  const [pmPrevData, setPmPrevData] = useState<Record<string, unknown> | null>(null);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(
    () => (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system',
  );

  // Apply theme: toggle .dark on <html>, follow OS when set to system
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    localStorage.setItem('theme', theme);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

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
            next[key] = { status: 'done', data: modules[key].data, changes: modules[key].changes, quality: modules[key].quality };
          }
        }
        return next;
      });
    });
  }, []);

  // Refresh the prior matrix snapshot whenever the matrix itself changes
  useEffect(() => {
    if (!state.positioningMatrix.data) {
      setPmPrevData(null);
      return;
    }
    fetch('/api/modules/positioningMatrix/versions')
      .then(r => r.json())
      .then((d) => setPmPrevData(d.versions?.[0]?.data ?? null))
      .catch(() => setPmPrevData(null));
  }, [state.positioningMatrix.data]);

  useEffect(() => {
    loadInput();
    loadModules();
    fetch('/api/settings').then(r => r.json()).then((d) => {
      setProvider(d.provider);
      setModel(d.model);
      setProviders(d.providers);
    });
  }, [loadInput, loadModules]);

  const handleSwitchModel = useCallback(async (p: string, m: string) => {
    const res = await fetch('/api/settings/model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: p, model: m }),
    });
    if (res.ok) {
      const d = await res.json();
      setProvider(d.provider);
      setModel(d.model);
      setProviders(d.providers);
    }
  }, []);

  const handleSaveKey = useCallback(async (p: string, apiKey: string): Promise<boolean> => {
    const res = await fetch('/api/settings/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: p, api_key: apiKey }),
    });
    if (res.ok) {
      const d = await res.json();
      setProviders(d.providers);
      return true;
    }
    return false;
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
          [event.module]: { status: 'done', data: event.data, changes: event.changes ?? null, quality: event.quality ?? prev[event.module as ModuleName].quality },
        }));
      } else if (event.type === 'text_start') {
        setStreamingText('');
      } else if (event.type === 'token') {
        setStreamingText(prev => prev + event.content);
      } else if (event.type === 'input_changed') {
        loadInput();
        loadModules();
      }
    };
    return () => es.close();
  }, [loadInput, loadModules]);

  // Re-pull the authoritative message list from the server — heals any
  // divergence between optimistic local state and the persisted thread
  const resyncThread = useCallback(async (tid: string) => {
    try {
      const d = await fetch(`/api/threads/${tid}/select`, { method: 'POST' }).then(r => r.json());
      if (Array.isArray(d.messages)) setMessages(d.messages);
    } catch { /* server unreachable — keep local view */ }
  }, []);

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
      // Stay on the current brief: prefer one of ITS threads; otherwise
      // start a fresh one here rather than jumping to another brief's thread
      const sameBrief = remaining.find((t) => t.brief === activeInput);
      if (sameBrief) {
        handleSelectThread(sameBrief.id);
      } else {
        handleNewThread();
      }
    }
  }, [activeThread, activeInput, loadThreads, handleSelectThread, handleNewThread]);

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
      const res = await fetch(`/api/threads/${activeThread}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index, message }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.messages) setMessages(d.messages);
      } else {
        // Stale index or server error — restore the authoritative view
        await resyncThread(activeThread);
      }
      loadThreads();
    } catch {
      await resyncThread(activeThread);
    } finally {
      setIsLoading(false);
    }
  }, [activeThread, isLoading, loadThreads, resyncThread]);

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
      if (Array.isArray(data.messages)) {
        // Authoritative sync — local indices always match the server's
        setMessages(data.messages);
      } else if (data.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      }
      loadThreads();

      for (const event of data.events || []) {
        if (event.type === 'module_update') {
          setState(prev => ({
            ...prev,
            [event.module]: { status: 'done', data: event.data, changes: event.changes ?? null, quality: event.quality ?? prev[event.module as ModuleName].quality },
          }));
        }
      }
    } catch {
      // Heal from the server's truth first, then surface the failure
      if (activeThread) await resyncThread(activeThread);
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Could not reach the backend. Is it still running on port 8000?' }]);
    } finally {
      setIsLoading(false);
      setStreamingText('');
    }
  }, [activeThread, loadThreads, resyncThread]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-black dark:bg-slate-200 rounded-md flex items-center justify-center">
            <span className="text-white dark:text-slate-900 text-xs font-bold">G</span>
          </div>
          <span className="font-semibold text-sm text-gray-900 dark:text-slate-100">GTM Agent</span>
        </div>
        <div className="flex items-center gap-3">
          {Object.keys(providers).length > 0 && (
            <select
              value={`${provider}::${model}`}
              onChange={(e) => {
                const [p, m] = e.target.value.split('::');
                handleSwitchModel(p, m);
              }}
              title="Model for analysis generation"
              className="appearance-none text-[11px] text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1 cursor-pointer hover:border-gray-300 dark:hover:border-slate-500 focus:outline-none max-w-44 truncate"
            >
              {Object.entries(providers).map(([key, cfg]) => (
                <optgroup key={key} label={`${cfg.label}${cfg.available ? '' : ' (no key)'}`}>
                  {cfg.models.map((m) => (
                    <option key={m} value={`${key}::${m}`} disabled={!cfg.available}>
                      {m}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowSettings(true)}
            title="API keys"
            className="w-7 h-7 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-500 flex items-center justify-center transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button
            onClick={() => window.open('/api/export', '_blank')}
            title="Export the analysis as a Markdown report"
            className="w-7 h-7 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-500 flex items-center justify-center transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}
            title={`Theme: ${theme} (click to cycle)`}
            className="w-7 h-7 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-500 flex items-center justify-center transition-colors"
          >
            {theme === 'light' ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : theme === 'dark' ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            )}
          </button>
          <span className="text-xs text-gray-400 dark:text-slate-500">Go-To-Market Analysis</span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Input Panel */}
        <div className="w-64 shrink-0 border-r border-gray-200 dark:border-slate-700 overflow-y-auto">
          <InputPanel
            input={gameInput}
            files={inputFiles}
            active={activeInput}
            onSwitch={handleSwitchInput}
          />
        </div>

        {/* Middle: Canvas */}
        <div className="flex-1 overflow-y-auto min-w-0">
          <Canvas state={state} onQuote={setQuote} pmPrevData={pmPrevData} />
        </div>

        {/* Right: Chat */}
        <div className="w-96 shrink-0 border-l border-gray-200 dark:border-slate-700 flex flex-col min-h-0">
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
            activeBrief={activeInput}
            streamingText={streamingText}
          />
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          providers={providers}
          onSaveKey={handleSaveKey}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
