import type { GameInput } from '../types';

interface Props {
  input: GameInput | null;
}

export function InputPanel({ input }: Props) {
  if (!input) {
    return <div className="p-6 text-gray-400 text-sm">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
        Game Brief
      </h2>
      <h3 className="text-lg font-semibold text-gray-900 mt-3 leading-snug">
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
