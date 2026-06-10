import { useState, useEffect } from 'react';

export interface ProviderInfo {
  label: string;
  models: string[];
  available: boolean;
}

interface Props {
  providers: Record<string, ProviderInfo>;
  onSaveKey: (provider: string, apiKey: string) => Promise<boolean>;
  onClose: () => void;
}

/** API key management — keys go to the local backend's .env, never echoed back. */
export function SettingsModal({ providers, onSaveKey, onClose }: Props) {
  // Rendered outside Canvas, so it owns its own Esc handling
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">API Keys</h2>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Keys are stored locally in the backend's <code>.env</code> (gitignored) and never sent anywhere else.
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div className="px-6 py-4 space-y-4">
          {Object.entries(providers).map(([key, cfg]) => (
            <ProviderKeyRow key={key} provider={key} info={cfg} onSave={onSaveKey} />
          ))}
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}

function ProviderKeyRow({ provider, info, onSave }: {
  provider: string;
  info: ProviderInfo;
  onSave: (provider: string, apiKey: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const save = async () => {
    if (!value.trim()) return;
    setState('saving');
    const ok = await onSave(provider, value.trim());
    setState(ok ? 'saved' : 'error');
    if (ok) setValue('');
    setTimeout(() => setState('idle'), 2000);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{info.label}</span>
        {info.available ? (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-full">
            configured
          </span>
        ) : (
          <span className="text-[10px] text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800/60 px-1.5 py-0.5 rounded-full">
            no key
          </span>
        )}
        <span className="text-[10px] text-gray-300 dark:text-slate-600 ml-auto">
          {info.models.join(' · ')}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder={info.available ? 'Replace key…' : 'Paste API key…'}
          autoComplete="off"
          className="flex-1 text-xs text-gray-800 dark:text-slate-200 bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gray-400 dark:focus:border-slate-400 placeholder-gray-400 dark:placeholder-slate-500 transition-colors"
        />
        <button
          onClick={save}
          disabled={!value.trim() || state === 'saving'}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
            state === 'saved'
              ? 'bg-emerald-500 text-white'
              : state === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-black text-white dark:bg-slate-200 dark:text-slate-900 hover:bg-gray-800 dark:hover:bg-white disabled:bg-gray-200 dark:disabled:bg-slate-700 disabled:text-gray-400 dark:disabled:text-slate-500'
          }`}
        >
          {state === 'saving' ? '…' : state === 'saved' ? '✓' : state === 'error' ? '✗' : 'Save'}
        </button>
      </div>
    </div>
  );
}


function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Close (Esc)"
      className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700/60 flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors shrink-0"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}
