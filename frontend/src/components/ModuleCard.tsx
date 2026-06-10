import type { ModuleState, ModuleName } from '../types';
import { MODULE_META, StatusDot } from './moduleShared';

interface Props {
  name: ModuleName;
  module: ModuleState;
  onExpand: () => void;
}

export function ModuleCard({ name, module, onExpand }: Props) {
  const meta = MODULE_META[name];

  return (
    <div
      onClick={module.data ? onExpand : undefined}
      className={`group rounded-2xl border border-gray-200 bg-white transition-all ${
        module.data ? 'cursor-pointer hover:shadow-md hover:border-gray-300' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
            {meta.layer}
          </span>
          <span className="text-[15px] font-semibold text-gray-900">{meta.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <StatusDot status={module.status} />
          {module.data && (
            <svg
              className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 h-72 overflow-y-auto">
        {module.data ? (
          <ModulePreview name={name} data={module.data} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-gray-300 italic">Awaiting generation</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ModulePreview({ name, data }: { name: ModuleName; data: Record<string, unknown> }) {
  if (name === 'competitiveLandscape') {
    const competitors = (data.existingCompetitors as Array<{ name: string; rationale: string }>) || [];
    return (
      <div className="space-y-2.5">
        <p className="text-xs text-gray-400 leading-relaxed">{(data.summary as string)?.slice(0, 150)}…</p>
        {competitors.map((c, i) => (
          <div key={i} className="text-sm leading-snug">
            <span className="text-gray-900 font-medium">{c.name}</span>
            <span className="text-gray-400 text-xs ml-2">{c.rationale.slice(0, 80)}…</span>
          </div>
        ))}
      </div>
    );
  }

  if (name === 'audienceOverview') {
    const segments = (data.segments as Array<{ segmentName: string; description: string; selectedExistingCompetitors: string[] }>) || [];
    return (
      <div className="space-y-4">
        {segments.map((s, i) => (
          <div key={i}>
            <p className="text-sm font-medium text-gray-900">{s.segmentName}</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{s.description.slice(0, 120)}…</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {s.selectedExistingCompetitors.map((c, j) => (
                <span key={j} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {c}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (name === 'positioningMatrix') {
    return <PositioningChart data={data} compact />;
  }

  if (name === 'swot') {
    const categories = [
      { key: 'strengths', label: 'S', color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { key: 'weaknesses', label: 'W', color: 'text-red-500', bg: 'bg-red-50' },
      { key: 'opportunities', label: 'O', color: 'text-blue-600', bg: 'bg-blue-50' },
      { key: 'threats', label: 'T', color: 'text-amber-600', bg: 'bg-amber-50' },
    ];
    return (
      <div className="grid grid-cols-2 gap-4">
        {categories.map(({ key, label, color, bg }) => (
          <div key={key}>
            <span className={`text-[10px] font-bold ${color} ${bg} w-5 h-5 rounded inline-flex items-center justify-center mb-1.5`}>
              {label}
            </span>
            {((data[key] as Array<{ text: string }>) || []).slice(0, 3).map((item, i) => (
              <p key={i} className="text-xs text-gray-500 mb-1.5 leading-snug">{item.text.slice(0, 90)}…</p>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export function PositioningChart({ data, compact = false }: { data: Record<string, unknown>; compact?: boolean }) {
  const positions = (data.positions as Array<{ gameName: string; xPosition: number; yPosition: number }>) || [];
  const xAxis = data.xAxis as { axisName: string; lowLabel: string; highLabel: string };
  const yAxis = data.yAxis as { axisName: string; lowLabel: string; highLabel: string };

  return (
    <div className="h-full flex flex-col">
      <div className={`text-gray-400 mb-2 space-x-4 ${compact ? 'text-[10px]' : 'text-xs'}`}>
        <span><b className="text-gray-500">X</b> {xAxis?.axisName}</span>
        <span><b className="text-gray-500">Y</b> {yAxis?.axisName}</span>
      </div>
      <div className={`relative w-full bg-gray-50 rounded-xl border border-gray-100 ${compact ? 'flex-1 min-h-44' : 'h-[420px]'}`}>
        {/* Center lines */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-200" />

        {/* X axis labels — bottom edge */}
        <span className={`absolute bottom-1.5 left-1.5 ${compact ? 'text-[9px]' : 'text-[11px]'} font-medium text-gray-500 bg-white/90 border border-gray-100 rounded px-1.5 py-0.5 z-10`}>
          ← {xAxis?.lowLabel}
        </span>
        <span className={`absolute bottom-1.5 right-1.5 ${compact ? 'text-[9px]' : 'text-[11px]'} font-medium text-gray-500 bg-white/90 border border-gray-100 rounded px-1.5 py-0.5 z-10`}>
          {xAxis?.highLabel} →
        </span>

        {/* Y axis labels — top-left and upper-left, stacked clear of X labels */}
        <span className={`absolute top-1.5 left-1.5 ${compact ? 'text-[9px]' : 'text-[11px]'} font-medium text-gray-500 bg-white/90 border border-gray-100 rounded px-1.5 py-0.5 z-10`}>
          ↑ {yAxis?.highLabel}
        </span>
        <span className={`absolute bottom-8 left-1.5 ${compact ? 'text-[9px]' : 'text-[11px]'} font-medium text-gray-500 bg-white/90 border border-gray-100 rounded px-1.5 py-0.5 z-10`}>
          ↓ {yAxis?.lowLabel}
        </span>

        {positions.map((p, i) => {
          const isDune = p.gameName.includes('Dune');
          // Alternate labels above/below the dot so neighbors don't collide
          const labelAbove = !isDune && i % 2 === 1;
          // Compact view: only label the game itself; competitors reveal on hover
          const hoverOnly = compact && !isDune;
          return (
            <div
              key={i}
              className={`group/dot absolute transform -translate-x-1/2 translate-y-1/2 flex items-center ${labelAbove ? 'flex-col-reverse' : 'flex-col'}`}
              style={{
                left: `${8 + (p.xPosition / 10) * 84}%`,
                bottom: `${8 + (p.yPosition / 10) * 84}%`,
                zIndex: isDune ? 5 : 1,
              }}
            >
              <div className={`rounded-full shrink-0 ${isDune ? 'bg-black w-3 h-3 ring-4 ring-black/10' : 'bg-gray-300 w-2.5 h-2.5 hover:bg-gray-400'}`} />
              <span
                className={`whitespace-nowrap rounded px-1 ${labelAbove ? 'mb-1' : 'mt-1'} ${compact ? 'text-[9px]' : 'text-[11px]'} ${
                  isDune ? 'text-gray-900 font-semibold bg-white/80' : 'text-gray-500 bg-white/90'
                } ${hoverOnly ? 'opacity-0 group-hover/dot:opacity-100 transition-opacity z-20' : ''}`}
              >
                {p.gameName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
