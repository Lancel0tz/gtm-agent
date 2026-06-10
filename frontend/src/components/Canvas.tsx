import { useState } from 'react';
import type { AppState, ModuleName, EntityRef } from '../types';
import { ModuleCard } from './ModuleCard';
import { ModuleDetail } from './ModuleDetail';
import { EntityPopover } from './EntityPopover';

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
  const [entity, setEntity] = useState<EntityRef | null>(null);

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
            onEntityClick={setEntity}
          />
        ))}
      </div>

      {expanded && (
        <ModuleDetail
          name={expanded}
          module={state[expanded]}
          onClose={() => setExpanded(null)}
          onEntityClick={setEntity}
        />
      )}

      {entity && (
        <EntityPopover
          entity={entity}
          state={state}
          onClose={() => setEntity(null)}
          onNavigate={setEntity}
        />
      )}
    </div>
  );
}
