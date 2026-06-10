import { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import type { ChatMessage, AppState, ModuleName } from '../types';
import type { ThreadSummary } from '../App';
import { MODULE_META } from './moduleShared';

interface Props {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading: boolean;
  modules: AppState;
  threads: ThreadSummary[];
  activeThread: string | null;
  onSelectThread: (tid: string) => void;
  onNewThread: () => void;
  onDeleteThread: (tid: string) => void;
  onRegenerate: () => void;
  onUndo: () => void;
}

const MODULE_ORDER: ModuleName[] = [
  'competitiveLandscape',
  'audienceOverview',
  'positioningMatrix',
  'swot',
];

export function ChatPanel({
  messages, onSend, isLoading, modules,
  threads, activeThread, onSelectThread, onNewThread, onDeleteThread,
  onRegenerate, onUndo,
}: Props) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header: thread switcher */}
      <div className="px-4 py-2.5 border-b border-gray-100 shrink-0 flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <select
            value={activeThread ?? ''}
            onChange={(e) => e.target.value && onSelectThread(e.target.value)}
            disabled={isLoading}
            className="w-full appearance-none text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg pl-2.5 pr-7 py-1.5 cursor-pointer hover:border-gray-300 focus:outline-none focus:border-gray-400 transition-colors truncate disabled:opacity-50"
          >
            {!activeThread && <option value="">New chat</option>}
            {threads.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}{t.brief ? ` — ${t.brief.replace(/\.md$/, '')}` : ''}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <button
          onClick={onNewThread}
          disabled={isLoading}
          title="New chat"
          className="w-7 h-7 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300 flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        {activeThread && (
          <button
            onClick={() => onDeleteThread(activeThread)}
            disabled={isLoading}
            title="Delete this chat"
            className="w-7 h-7 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-gray-400 mb-4">Ask me anything about the GTM analysis</p>
            <div className="space-y-2">
              {[
                'Generate the full GTM analysis',
                'What does the positioning say?',
                'Add Nightingale as a competitor',
              ].map((text) => (
                <button
                  key={text}
                  onClick={() => onSend(text)}
                  className="block w-full text-left text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isLast = i === messages.length - 1;
          return (
            <div key={i} className={`group/msg flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[85%] text-sm rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="markdown-body">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
              {msg.role === 'assistant' && !isLoading && (
                <MessageActions
                  content={msg.content}
                  showTurnActions={isLast}
                  onRegenerate={onRegenerate}
                  onUndo={onUndo}
                />
              )}
            </div>
          );
        })}

        {isLoading && <WorkingIndicator modules={modules} />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-100 shrink-0">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-gray-400 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !input.trim()}
            className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}


/** Shown while the agent works. Lists only the modules touched THIS turn
 *  with their live status; before any module starts, shows a thinking row.
 *  Mounted only while isLoading, so the seen-set resets every turn. */
function WorkingIndicator({ modules }: { modules: AppState }) {
  const [seen, setSeen] = useState<Set<ModuleName>>(new Set());

  useEffect(() => {
    const nowGenerating = MODULE_ORDER.filter((m) => modules[m].status === 'generating');
    if (nowGenerating.some((m) => !seen.has(m))) {
      setSeen((prev) => new Set([...prev, ...nowGenerating]));
    }
  }, [modules, seen]);

  const rows = MODULE_ORDER.filter((m) => seen.has(m));

  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-2xl px-4 py-3 mr-8 min-w-[220px]">
        {rows.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Updating modules</p>
            {rows.map((m) => {
              const status = modules[m].status;
              return (
                <div key={m} className="flex items-center gap-2">
                  {status === 'generating' ? <Spinner /> : <CheckIcon />}
                  <span className={`text-xs ${status === 'generating' ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                    {MODULE_META[m].label}
                  </span>
                  {status === 'generating' && (
                    <span className="text-[10px] text-blue-500 animate-pulse ml-auto">generating</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Spinner />
            <span className="text-xs text-gray-500">Thinking…</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}


/** Hover action row under assistant messages: copy always; regenerate +
 *  undo only on the latest reply (they operate on the last turn). */
function MessageActions({ content, showTurnActions, onRegenerate, onUndo }: {
  content: string;
  showTurnActions: boolean;
  onRegenerate: () => void;
  onUndo: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-0.5 mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
      <ActionButton title={copied ? 'Copied!' : 'Copy'} onClick={copy}>
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </ActionButton>
      {showTurnActions && (
        <>
          <ActionButton title="Regenerate response (re-runs the request)" onClick={onRegenerate}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </ActionButton>
          <ActionButton title="Undo this turn (reverts module changes too)" onClick={onUndo}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 14 4 9 9 4" />
              <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
            </svg>
          </ActionButton>
        </>
      )}
    </div>
  );
}

function ActionButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="w-6 h-6 rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors"
    >
      {children}
    </button>
  );
}
