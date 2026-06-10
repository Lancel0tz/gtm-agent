import type { ModuleName, ModuleChanges } from '../types';

export const MODULE_META: Record<ModuleName, { label: string; layer: string; description: string }> = {
  competitiveLandscape: {
    label: 'Competitive Landscape',
    layer: 'L1',
    description: 'Real competing titles identified from the game brief, with rationale for each.',
  },
  audienceOverview: {
    label: 'Audience Overview',
    layer: 'L2',
    description: 'Audience segments grounded in the competitive landscape.',
  },
  positioningMatrix: {
    label: 'Positioning Matrix',
    layer: 'L3',
    description: 'The game plotted against competitors on two strategic axes.',
  },
  swot: {
    label: 'SWOT Analysis',
    layer: 'L3',
    description: 'Strengths, weaknesses, opportunities and threats grounded in upstream modules.',
  },
};

/** Read accumulated additions/removals for one list field of a module. */
export function fieldChanges(
  changes: ModuleChanges | null | undefined,
  field: string,
): { added: Set<string>; removed: Array<Record<string, unknown>> } {
  return {
    added: new Set(changes?.added?.[field] || []),
    removed: changes?.removed?.[field] || [],
  };
}

/** Axis endpoint label for the positioning chart. Falls back to combining
 *  with the axis name when the model produced a bare word like "High". */
export function axisLabel(label: string | undefined, axisName: string | undefined): string {
  if (!label) return '';
  if (label.trim().split(/\s+/).length > 1) return label;
  return axisName ? `${label} ${axisName}` : label;
}

export function NewBadge() {
  return (
    <span className="inline-block align-middle relative -top-[1.5px] text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full uppercase tracking-wide leading-none">
      new
    </span>
  );
}

export function RemovedTag() {
  return (
    <span className="inline-block align-middle relative -top-[0.5px] text-[9px] text-red-300 uppercase tracking-wide leading-none shrink-0">
      removed
    </span>
  );
}

/** Context for cross-module entity links: known competitor/segment names. */
export interface EntityContext {
  competitors: string[];
  segments: string[];
}

/** Render text with known competitor/segment names as clickable links. */
export function EntityText({
  text,
  ctx,
  onEntityClick,
}: {
  text: string;
  ctx?: EntityContext;
  onEntityClick?: (e: { kind: 'competitor' | 'segment'; name: string }) => void;
}) {
  if (!ctx || !onEntityClick) return <>{text}</>;

  const names = [
    ...ctx.competitors.map((n) => ({ name: n, kind: 'competitor' as const })),
    ...ctx.segments.map((n) => ({ name: n, kind: 'segment' as const })),
  ].sort((a, b) => b.name.length - a.name.length);
  if (names.length === 0) return <>{text}</>;

  const escaped = names.map((n) => n.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        const match = names.find((n) => n.name === part);
        if (!match) return <span key={i}>{part}</span>;
        return (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              onEntityClick({ kind: match.kind, name: match.name });
            }}
            className="text-gray-900 font-medium underline decoration-dotted decoration-gray-300 underline-offset-2 hover:decoration-gray-500"
          >
            {part}
          </button>
        );
      })}
    </>
  );
}

/** Serialize a module into readable text for quoting in chat. */
export function moduleToQuote(name: ModuleName, data: Record<string, unknown>): string {
  if (name === 'competitiveLandscape') {
    const items = (data.existingCompetitors as Array<{ name: string }>) || [];
    return `Competitive Landscape (${items.length} competitors): ${items.map((c) => c.name).join(', ')}`;
  }
  if (name === 'audienceOverview') {
    const segs = (data.segments as Array<{ segmentName: string }>) || [];
    return `Audience Overview (${segs.length} segments): ${segs.map((s) => s.segmentName).join(', ')}`;
  }
  if (name === 'positioningMatrix') {
    const x = data.xAxis as { axisName: string };
    const y = data.yAxis as { axisName: string };
    const pos = (data.positions as Array<{ gameName: string; xPosition: number; yPosition: number }>) || [];
    return `Positioning Matrix — X: ${x?.axisName}, Y: ${y?.axisName}. Positions: ${pos.map((p) => `${p.gameName} (${p.xPosition}, ${p.yPosition})`).join('; ')}`;
  }
  if (name === 'swot') {
    const part = (key: string, label: string) => {
      const items = (data[key] as Array<{ text: string }>) || [];
      return `${label}: ${items.map((i) => i.text).join(' | ')}`;
    };
    return `SWOT — ${part('strengths', 'S')}\n${part('weaknesses', 'W')}\n${part('opportunities', 'O')}\n${part('threats', 'T')}`.slice(0, 1200);
  }
  return JSON.stringify(data).slice(0, 600);
}

export function QuoteButton({ onClick, title = 'Quote this module in chat' }: { onClick: () => void; title?: string }) {
  return (
    <button
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="w-6 h-6 rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors shrink-0"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z" />
      </svg>
    </button>
  );
}

export function StatusDot({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    idle: { color: 'bg-gray-300', label: 'Idle' },
    pending: { color: 'bg-yellow-400', label: 'Pending' },
    generating: { color: 'bg-blue-500 animate-pulse', label: 'Generating' },
    done: { color: 'bg-emerald-500', label: 'Done' },
  };
  const c = config[status] || config.idle;

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${c.color}`} />
      <span className="text-[11px] text-gray-400">{c.label}</span>
    </div>
  );
}
