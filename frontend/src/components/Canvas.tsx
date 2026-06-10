import { useState } from 'react';
import type { AppState, ModuleName } from '../types';
import { ModuleCard } from './ModuleCard';
import { ModuleDetail } from './ModuleDetail';

interface Props {
  state: AppState;
}

const MODULE_ORDER: ModuleName[] = [
  'competitiveLandscape',
  'audienceOverview',
  'positioningMatrix',
  'swot',
];

export function Canvas({ state }: Props) {
  const [expanded, setExpanded] = useState<ModuleName | null>(null);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">
        Analysis Modules
      </h2>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {MODULE_ORDER.map((name) => (
          <ModuleCard
            key={name}
            name={name}
            module={state[name]}
            onExpand={() => setExpanded(name)}
          />
        ))}
      </div>

      {expanded && (
        <ModuleDetail
          name={expanded}
          module={state[expanded]}
          onClose={() => setExpanded(null)}
        />
      )}
    </div>
  );
}
