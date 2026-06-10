import { useState, useEffect } from 'react';
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

  // Known entity names, for linkifying competitor/segment mentions in text
  const ctx = {
    competitors: ((state.competitiveLandscape.data?.existingCompetitors as Array<{ name: string }> | undefined) || []).map((c) => c.name),
    segments: ((state.audienceOverview.data?.segments as Array<{ segmentName: string }> | undefined) || []).map((s) => s.segmentName),
  };

  // Esc closes the TOP layer only: entity popover first, then module detail
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (entity) setEntity(null);
      else if (expanded) setExpanded(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [entity, expanded]);

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
            ctx={ctx}
          />
        ))}
      </div>

      {expanded && (
        <ModuleDetail
          name={expanded}
          module={state[expanded]}
          onClose={() => setExpanded(null)}
          onEntityClick={setEntity}
          ctx={ctx}
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
