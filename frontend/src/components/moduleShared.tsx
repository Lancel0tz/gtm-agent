import type { ModuleName } from '../types';

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
