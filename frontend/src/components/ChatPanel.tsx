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
  onRenameThread: (tid: string, title: string) => void;
  onEditMessage: (index: number, message: string) => void;
  quote: string | null;
  onClearQuote: () => void;
  onStop: () => void;
  activeBrief: string;
  streamingText: string;
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
  onRegenerate, onUndo, onRenameThread, onEditMessage, quote, onClearQuote, onStop, activeBrief, streamingText,
}: Props) {
  const [input, setInput] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    const full = quote
      ? `> ${quote.replace(/\n/g, '\n> ')}\n\n${trimmed}`
      : trimmed;
    onSend(full);
    setInput('');
    onClearQuote();
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
      <div className="px-4 py-2.5 border-b border-gray-100 dark:border-slate-800 shrink-0 flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          {renaming && activeThread ? (
            <input
              autoFocus
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              onBlur={() => {
                if (renameText.trim()) onRenameThread(activeThread, renameText.trim());
                setRenaming(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setRenaming(false);
              }}
              className="w-full text-xs text-gray-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-gray-400 dark:border-slate-500 rounded-lg px-2.5 py-1.5 focus:outline-none"
            />
          ) : (
          <select
            value={activeThread ?? ''}
            onChange={(e) => e.target.value && onSelectThread(e.target.value)}
            disabled={isLoading}
            className="w-full appearance-none text-xs text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-lg pl-2.5 pr-7 py-1.5 cursor-pointer hover:border-gray-300 dark:hover:border-slate-500 focus:outline-none focus:border-gray-400 dark:focus:border-slate-400 transition-colors truncate disabled:opacity-50"
          >
            {!activeThread && <option value="">New chat</option>}
            {threads.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}{t.brief ? ` — ${t.brief.replace(/\.md$/, '')}` : ''}
              </option>
            ))}
          </select>
          )}
          {!renaming && (
            <svg
              className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 dark:text-slate-500 pointer-events-none"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>
        {activeThread && !renaming && (
          <button
            onClick={() => {
              const t = threads.find((x) => x.id === activeThread);
              setRenameText(t?.title ?? '');
              setRenaming(true);
            }}
            disabled={isLoading}
            title="Rename this chat"
            className="w-7 h-7 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-500 flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </button>
        )}
        <button
          onClick={onNewThread}
          disabled={isLoading}
          title="New chat"
          className="w-7 h-7 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-500 flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
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
            className="w-7 h-7 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
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
            <p className="text-sm text-gray-400 dark:text-slate-500 mb-4">Ask me anything about the GTM analysis</p>
            <div className="space-y-2">
              {buildSuggestions(modules, activeBrief).map((text) => (
                <button
                  key={text}
                  onClick={() => onSend(text)}
                  className="block w-full text-left text-sm text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-500 transition-colors"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isLast = i === messages.length - 1;

          if (editingIndex === i) {
            return (
              <div key={i} className="flex flex-col items-end">
                <div className="w-[85%] bg-gray-50 dark:bg-slate-800/60 border border-gray-300 dark:border-slate-600 rounded-2xl p-3">
                  <textarea
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={Math.min(6, editText.split('\n').length + 1)}
                    className="w-full bg-transparent text-sm text-gray-900 dark:text-slate-100 outline-none resize-none"
                  />
                  <div className="flex justify-end gap-2 mt-1">
                    <button
                      onClick={() => setEditingIndex(null)}
                      className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const t = editText.trim();
                        if (t) {
                          onEditMessage(i, t);
                          setEditingIndex(null);
                        }
                      }}
                      className="text-xs bg-black text-white dark:bg-slate-200 dark:text-slate-900 px-2.5 py-1 rounded-lg hover:bg-gray-800 dark:hover:bg-white transition-colors"
                    >
                      Save & resend
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[85%] text-sm rounded-2xl px-4 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-black text-white dark:bg-slate-200 dark:text-slate-900'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200'
                }`}
              >
                <div className={msg.role === 'user' ? 'markdown-body markdown-user' : 'markdown-body'}>
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>
              {!isLoading && (
                msg.role === 'assistant' ? (
                  <MessageActions
                    content={msg.content}
                    showTurnActions={isLast}
                    onRegenerate={onRegenerate}
                    onUndo={onUndo}
                  />
                ) : (
                  <div className="flex items-center gap-0.5 mt-1">
                    <ActionButton
                      title="Edit & resend (discards everything after)"
                      onClick={() => {
                        setEditText(msg.content);
                        setEditingIndex(i);
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                      </svg>
                    </ActionButton>
                  </div>
                )
              )}
            </div>
          );
        })}

        {isLoading && streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] text-sm rounded-2xl px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200">
              <div className="markdown-body">
                <Markdown>{streamingText}</Markdown>
              </div>
              <span className="inline-block w-1.5 h-3.5 bg-gray-400 dark:bg-slate-500 animate-pulse ml-0.5 align-text-bottom" />
            </div>
          </div>
        )}
        {isLoading && !streamingText && <WorkingIndicator modules={modules} />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-100 dark:border-slate-800 shrink-0">
        {quote && (
          <div className="flex items-start gap-2 mb-2 bg-gray-50 dark:bg-slate-800/60 border-l-2 border-gray-300 dark:border-slate-600 rounded-r-lg px-3 py-2">
            <p className="flex-1 text-xs text-gray-500 dark:text-slate-400 italic line-clamp-3">{quote}</p>
            <button
              onClick={onClearQuote}
              className="text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-400 shrink-0 transition-colors"
              title="Remove quote"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2 focus-within:border-gray-400 dark:focus-within:border-slate-400 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 outline-none disabled:opacity-50"
          />
          {isLoading ? (
            <button
              type="button"
              onClick={onStop}
              title="Stop generating"
              className="w-7 h-7 rounded-lg bg-black text-white dark:bg-slate-200 dark:text-slate-900 flex items-center justify-center hover:bg-gray-700 dark:hover:bg-white transition-colors shrink-0"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="w-7 h-7 rounded-lg bg-black text-white dark:bg-slate-200 dark:text-slate-900 flex items-center justify-center hover:bg-gray-800 dark:hover:bg-white disabled:bg-gray-200 dark:disabled:bg-slate-700 disabled:text-gray-400 dark:disabled:text-slate-500 transition-colors shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          )}
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
    const nowGenerating = MODULE_ORDER.filter((m) => modules[m].status === 'generating' || modules[m].status === 'reviewing');
    if (nowGenerating.some((m) => !seen.has(m))) {
      setSeen((prev) => new Set([...prev, ...nowGenerating]));
    }
  }, [modules, seen]);

  const rows = MODULE_ORDER.filter((m) => seen.has(m));

  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 dark:bg-slate-800 rounded-2xl px-4 py-3 mr-8 min-w-[220px]">
        {rows.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Updating modules</p>
            {rows.map((m) => {
              const status = modules[m].status;
              return (
                <div key={m} className="flex items-center gap-2">
                  {status === 'generating' || status === 'reviewing' ? <Spinner /> : <CheckIcon />}
                  <span className={`text-xs ${status === 'generating' || status === 'reviewing' ? 'text-gray-900 dark:text-slate-100 font-medium' : 'text-gray-400 dark:text-slate-500'}`}>
                    {MODULE_META[m].label}
                  </span>
                  {status === 'generating' && (
                    <span className="text-[10px] text-blue-500 animate-pulse ml-auto">generating</span>
                  )}
                  {status === 'reviewing' && (
                    <span className="text-[10px] text-purple-500 animate-pulse ml-auto">reviewing</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Spinner />
            <span className="text-xs text-gray-500 dark:text-slate-400">Thinking…</span>
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
  onRenameThread: (tid: string, title: string) => void;
  onEditMessage: (index: number, message: string) => void;
  quote: string | null;
  onClearQuote: () => void;
  onStop: () => void;
  activeBrief: string;
  streamingText: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-0.5 mt-1">
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
      className="w-6 h-6 rounded-md text-gray-300 dark:text-slate-600 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/60 flex items-center justify-center transition-colors"
    >
      {children}
    </button>
  );
}


/** Suggestion prompts adapted to the current brief and module state. */
function buildSuggestions(modules: AppState, activeBrief: string): string[] {
  const hasModules = MODULE_ORDER.some((m) => modules[m].data);
  if (!hasModules) {
    return ['Generate the full GTM analysis for this game'];
  }
  const suggestions = ['What does the positioning say?'];
  // The spec's sample cascade case applies to the Dune brief specifically
  if (activeBrief === 'input.md') {
    suggestions.push('Add Nightingale as a competitor');
  } else {
    const competitors = (modules.competitiveLandscape.data?.existingCompetitors as Array<{ name: string }> | undefined) || [];
    if (competitors.length > 0) {
      suggestions.push(`Why is ${competitors[0].name} in the competitive set?`);
    }
  }
  suggestions.push('Summarize the SWOT analysis');
  return suggestions;
}
