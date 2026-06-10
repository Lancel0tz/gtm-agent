import type { GameInput } from '../types';

interface Props {
  input: GameInput | null;
  files: string[];
  active: string;
  onSwitch: (filename: string) => void;
}

export function InputPanel({ input, files, active, onSwitch }: Props) {
  if (!input) {
    return <div className="p-6 text-gray-400 text-sm">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Game Brief
        </h2>
      </div>

      {/* Input file switcher */}
      <div className="mt-3">
        <div className="relative">
          <select
            value={active}
            onChange={(e) => onSwitch(e.target.value)}
            className="w-full appearance-none text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg pl-3 pr-8 py-2 cursor-pointer hover:border-gray-300 focus:outline-none focus:border-gray-400 transition-colors"
          >
            {files.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <svg
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        {files.length === 1 && (
          <p className="text-[10px] text-gray-300 mt-1.5 leading-snug">
            Drop more <code className="text-gray-400">.md</code> briefs into <code className="text-gray-400">inputs/</code> to switch games.
          </p>
        )}
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mt-5 leading-snug">
        {input.title}
      </h3>

      <div className="mt-6 space-y-4">
        <Field label="Genre" value={input.genre} />
        <Field label="Platform" value={input.platform} />
        <Field label="Price" value={input.price} />
      </div>

      <div className="mt-6 pt-6 border-t border-gray-100">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Description
        </span>
        <p className="text-sm text-gray-600 mt-3 leading-relaxed">
          {input.shortDescription}
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs text-gray-400 mb-1">{label}</span>
      <span className="block text-sm text-gray-800 font-medium leading-snug">{value}</span>
    </div>
  );
}
