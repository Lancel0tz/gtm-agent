import { useState, useEffect, useRef } from 'react';
import type { AppState, ModuleName, EntityRef } from '../types';
import { ModuleCard } from './ModuleCard';
import { ModuleDetail } from './ModuleDetail';
import { EntityPopover } from './EntityPopover';

interface Props {
  state: AppState;
  onQuote?: (text: string) => void;
  pmPrevPositions?: Array<{ gameName: string; xPosition: number; yPosition: number }> | null;
}

const MODULE_ORDER: ModuleName[] = [
  'competitiveLandscape',
  'audienceOverview',
  'positioningMatrix',
  'swot',
];

export function Canvas({ state, onQuote, pmPrevPositions }: Props) {
  const [expanded, setExpanded] = useState<ModuleName | null>(null);
  const [entity, setEntity] = useState<EntityRef | null>(null);
  // Which positioning lens is active — shared by the card and the detail view
  const [pmLens, setPmLens] = useState(0);
  // Floating "quote" button shown over a text selection
  const [quoteBtn, setQuoteBtn] = useState<{ x: number; y: number; text: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (text && text.length > 2 && sel && containerRef.current?.contains(sel.anchorNode)) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setQuoteBtn({ x: rect.left + rect.width / 2, y: rect.top, text });
    } else {
      setQuoteBtn(null);
    }
  };

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
    <div ref={containerRef} onMouseUp={handleMouseUp} className="p-8 max-w-5xl mx-auto">
      <h2 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-6">
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
            pmLens={pmLens}
            onQuote={onQuote}
            pmPrevPositions={pmPrevPositions}
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
          pmLens={pmLens}
          onSelectLens={setPmLens}
          onQuote={onQuote}
          pmPrevPositions={pmPrevPositions}
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

      {quoteBtn && onQuote && (
        <button
          className="fixed z-[70] -translate-x-1/2 -translate-y-full bg-black text-white dark:bg-slate-200 dark:text-slate-900 text-xs px-3 py-1.5 rounded-lg shadow-lg hover:bg-gray-800 dark:hover:bg-white transition-colors flex items-center gap-1.5"
          style={{ left: quoteBtn.x, top: quoteBtn.y - 6 }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onQuote(quoteBtn.text);
            setQuoteBtn(null);
            window.getSelection()?.removeAllRanges();
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z" />
          </svg>
          Quote in chat
        </button>
      )}
    </div>
  );
}
