import type { ModuleState, ModuleName, ModuleData, ModuleChanges, EntityRef } from '../types';
import { MODULE_META, StatusDot, fieldChanges, axisLabel, NewBadge, RemovedTag, EntityText, moduleToQuote, QuoteButton, QualityChip, SteamBadge } from './moduleShared';
import type { EntityContext } from './moduleShared';

interface Props {
  name: ModuleName;
  module: ModuleState;
  onExpand: () => void;
  onEntityClick: (entity: EntityRef) => void;
  ctx?: EntityContext;
  pmLens?: number;
  onQuote?: (text: string) => void;
}

export function ModuleCard({ name, module, onExpand, onEntityClick, ctx, pmLens = 0, onQuote }: Props) {
  const meta = MODULE_META[name];

  return (
    <div
      className={`group rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-all ${
        module.data ? 'hover:shadow-md hover:border-gray-300 dark:hover:border-slate-500' : ''
      }`}
    >
      {/* Header */}
      <div
        onClick={module.data ? onExpand : undefined}
        className={`flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800 ${module.data ? 'cursor-pointer' : ''}`}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800/60 px-1.5 py-0.5 rounded">
            {meta.layer}
          </span>
          <span className="text-[15px] font-semibold text-gray-900 dark:text-slate-100">{meta.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {module.quality && <QualityChip score={module.quality.score} feedback={module.quality.feedback} />}
          <StatusDot status={module.status} />
          {module.data && onQuote && (
            <QuoteButton onClick={() => onQuote(moduleToQuote(name, module.data!))} />
          )}
          {module.data && (
            <svg
              className="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-gray-500 dark:group-hover:text-slate-400 dark:hover:text-slate-400 transition-colors"
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

      {/* Indeterminate progress bar while generating */}
      {module.status === 'generating' && (
        <div className="h-0.5 overflow-hidden bg-blue-50 dark:bg-blue-950/50">
          <div className="h-full w-1/3 bg-blue-500 rounded-full animate-shimmer" />
        </div>
      )}

      {/* Body */}
      <div className={`px-5 py-4 h-72 overflow-y-auto transition-opacity ${module.status === 'generating' ? 'opacity-40' : ''}`}>
        {module.data ? (
          <ModulePreview name={name} data={module.data} changes={module.changes} onEntityClick={onEntityClick} ctx={ctx} pmLens={pmLens} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-gray-300 dark:text-slate-600 italic">Awaiting generation</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface PreviewProps {
  name: ModuleName;
  data: ModuleData;
  changes?: ModuleChanges | null;
  onEntityClick: (entity: EntityRef) => void;
  ctx?: EntityContext;
  pmLens?: number;
}

export function selectLensView(data: ModuleData, lens: number): ModuleData {
  const alts = (data.alternativeViews as ModuleData[] | undefined) || [];
  if (lens > 0 && alts[lens - 1]) return alts[lens - 1];
  return data;
}

function ModulePreview({ name, data, changes, onEntityClick, ctx, pmLens = 0 }: PreviewProps) {
  if (name === 'competitiveLandscape') {
    const competitors = (data.existingCompetitors as Array<{ name: string; rationale: string }>) || [];
    const { added, removed } = fieldChanges(changes, 'existingCompetitors');
    return (
      <div className="space-y-2.5">
        <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed">{(data.summary as string)?.slice(0, 150)}…</p>
        {competitors.map((c, i) => (
          <div key={i} className="text-sm leading-snug">
            <button
              onClick={() => onEntityClick({ kind: 'competitor', name: c.name })}
              className="align-middle text-gray-900 dark:text-slate-100 font-medium hover:underline underline-offset-2 decoration-gray-300 dark:decoration-slate-500"
            >
              {c.name}
            </button>
            {(c as Record<string, unknown>).verified === true && <span className="ml-1.5"><SteamBadge /></span>}
            {added.has(c.name) && <span className="ml-1.5 inline-block align-middle"><NewBadge /></span>}
            <span className="align-middle text-gray-400 dark:text-slate-500 text-xs ml-2">{c.rationale.slice(0, 80)}…</span>
          </div>
        ))}
        {removed.map((c, i) => (
          <div key={`removed-${i}`} className="text-sm leading-snug opacity-60">
            <span className="align-middle text-red-400 line-through font-medium">{String(c.name)}</span>
            <span className="ml-1.5"><RemovedTag /></span>
          </div>
        ))}
      </div>
    );
  }

  if (name === 'audienceOverview') {
    const segments = (data.segments as Array<{ segmentName: string; description: string; selectedExistingCompetitors: string[] }>) || [];
    const { added, removed } = fieldChanges(changes, 'segments');
    return (
      <div className="space-y-4">
        {segments.map((s, i) => (
          <div key={i}>
            <button
              onClick={() => onEntityClick({ kind: 'segment', name: s.segmentName })}
              className="align-middle text-sm font-medium text-gray-900 dark:text-slate-100 hover:underline underline-offset-2 decoration-gray-300 dark:decoration-slate-500"
            >
              {s.segmentName}
            </button>
            {added.has(s.segmentName) && <span className="ml-1.5 inline-block align-middle"><NewBadge /></span>}
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">{s.description.slice(0, 120)}…</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {s.selectedExistingCompetitors.map((c, j) => (
                <button
                  key={j}
                  onClick={() => onEntityClick({ kind: 'competitor', name: c })}
                  className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ))}
        {removed.map((s, i) => (
          <div key={`removed-${i}`} className="opacity-60">
            <span className="align-middle text-sm text-red-400 line-through font-medium">{String(s.segmentName)}</span>
            <span className="ml-1.5"><RemovedTag /></span>
          </div>
        ))}
      </div>
    );
  }

  if (name === 'positioningMatrix') {
    const view = selectLensView(data, pmLens);
    return <PositioningChart data={view} changes={pmLens === 0 ? changes : undefined} compact onEntityClick={onEntityClick} />;
  }

  if (name === 'swot') {
    const categories = [
      { key: 'strengths', label: 'S', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50' },
      { key: 'weaknesses', label: 'W', color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/50' },
      { key: 'opportunities', label: 'O', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50' },
      { key: 'threats', label: 'T', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50' },
    ];
    return (
      <div className="grid grid-cols-2 gap-4">
        {categories.map(({ key, label, color, bg }) => {
          const items = (data[key] as Array<{ text: string }>) || [];
          const { added } = fieldChanges(changes, key);
          return (
            <div key={key}>
              <span className={`text-[10px] font-bold ${color} ${bg} w-5 h-5 rounded inline-flex items-center justify-center mb-1.5`}>
                {label}
              </span>
              {items.slice(0, 3).map((item, i) => (
                <p key={i} className="text-xs text-gray-500 dark:text-slate-400 mb-1.5 leading-snug">
                  <EntityText text={item.text.slice(0, 90) + '…'} ctx={ctx} onEntityClick={onEntityClick} />
                  {added.has(item.text) && <span className="ml-1"><NewBadge /></span>}
                </p>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}

interface ChartProps {
  data: ModuleData;
  changes?: ModuleChanges | null;
  compact?: boolean;
  onEntityClick?: (entity: EntityRef) => void;
  /** Names to emphasize; all other competitor dots are dimmed */
  highlight?: string[];
}

export function PositioningChart({ data, changes, compact = false, onEntityClick, highlight }: ChartProps) {
  const positions = (data.positions as Array<{ gameName: string; xPosition: number; yPosition: number }>) || [];
  const xAxis = data.xAxis as { axisName: string; lowLabel: string; highLabel: string };
  const yAxis = data.yAxis as { axisName: string; lowLabel: string; highLabel: string };
  const { removed } = fieldChanges(changes, 'positions');

  return (
    <div className="h-full flex flex-col">
      <div className={`text-gray-400 dark:text-slate-500 mb-2 space-x-4 ${compact ? 'text-[10px]' : 'text-xs'}`}>
        <span><b className="text-gray-500 dark:text-slate-400">X</b> {xAxis?.axisName}</span>
        <span><b className="text-gray-500 dark:text-slate-400">Y</b> {yAxis?.axisName}</span>
      </div>
      <div className={`relative w-full bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-100 dark:border-slate-800 ${compact ? 'flex-1 min-h-44' : 'h-[420px]'}`}>
        {/* Center lines */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 dark:bg-slate-700" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-200 dark:bg-slate-700" />

        {/* X axis labels — bottom edge */}
        <span className={`absolute bottom-1.5 left-1.5 ${compact ? 'text-[9px]' : 'text-[11px]'} font-medium text-gray-500 dark:text-slate-400 bg-white/90 dark:bg-slate-800/90 border border-gray-100 dark:border-slate-800 rounded px-1.5 py-0.5 z-10`}>
          ← {axisLabel(xAxis?.lowLabel, xAxis?.axisName)}
        </span>
        <span className={`absolute bottom-1.5 right-1.5 ${compact ? 'text-[9px]' : 'text-[11px]'} font-medium text-gray-500 dark:text-slate-400 bg-white/90 dark:bg-slate-800/90 border border-gray-100 dark:border-slate-800 rounded px-1.5 py-0.5 z-10`}>
          {axisLabel(xAxis?.highLabel, xAxis?.axisName)} →
        </span>

        {/* Y axis labels */}
        <span className={`absolute top-1.5 left-1.5 ${compact ? 'text-[9px]' : 'text-[11px]'} font-medium text-gray-500 dark:text-slate-400 bg-white/90 dark:bg-slate-800/90 border border-gray-100 dark:border-slate-800 rounded px-1.5 py-0.5 z-10`}>
          ↑ {axisLabel(yAxis?.highLabel, yAxis?.axisName)}
        </span>
        <span className={`absolute bottom-8 left-1.5 ${compact ? 'text-[9px]' : 'text-[11px]'} font-medium text-gray-500 dark:text-slate-400 bg-white/90 dark:bg-slate-800/90 border border-gray-100 dark:border-slate-800 rounded px-1.5 py-0.5 z-10`}>
          ↓ {axisLabel(yAxis?.lowLabel, yAxis?.axisName)}
        </span>

        {positions.map((p, i) => {
          const isDune = i === 0 || p.gameName.includes('Dune');
          const isHighlighted = highlight?.includes(p.gameName) ?? false;
          const isDimmed = !!highlight && !isHighlighted && !isDune;
          const labelAbove = !isDune && i % 2 === 1;
          const hoverOnly = compact && !isDune && !isHighlighted;
          return (
            <div
              key={i}
              onClick={!isDune && onEntityClick ? () => onEntityClick({ kind: 'competitor', name: p.gameName }) : undefined}
              className={`group/dot absolute transform -translate-x-1/2 translate-y-1/2 flex items-center ${labelAbove ? 'flex-col-reverse' : 'flex-col'} ${
                isDune ? 'z-[5]' : 'z-[1] cursor-pointer'
              } hover:z-30`}
              style={{
                left: `${8 + (p.xPosition / 10) * 84}%`,
                bottom: `${8 + (p.yPosition / 10) * 84}%`,
              }}
            >
              <div className={`rounded-full shrink-0 transition-all ${
                isDune
                  ? 'bg-black w-3 h-3 ring-4 ring-black/10'
                  : isHighlighted
                    ? 'bg-blue-500 w-3 h-3 ring-4 ring-blue-100'
                    : `bg-gray-300 dark:bg-slate-600 w-2.5 h-2.5 group-hover/dot:bg-gray-700 dark:group-hover/dot:bg-slate-300 group-hover/dot:scale-125 group-hover/dot:ring-4 group-hover/dot:ring-gray-200 dark:group-hover/dot:ring-slate-600 ${isDimmed ? 'opacity-30' : ''}`
              }`} />
              <span
                className={`whitespace-nowrap rounded px-1 transition-all ${labelAbove ? 'mb-1' : 'mt-1'} ${compact ? 'text-[9px]' : 'text-[11px]'} ${
                  isDune
                    ? 'text-gray-900 dark:text-slate-100 font-semibold bg-white/80 dark:bg-slate-800/80'
                    : isHighlighted
                      ? 'text-blue-600 dark:text-blue-400 font-semibold bg-white/90 dark:bg-slate-800/90'
                      : `text-gray-500 dark:text-slate-400 bg-white/90 dark:bg-slate-800/90 group-hover/dot:text-gray-900 dark:group-hover/dot:text-slate-100 group-hover/dot:font-medium group-hover/dot:bg-white dark:group-hover/dot:bg-slate-800 group-hover/dot:shadow-md group-hover/dot:border group-hover/dot:border-gray-200 dark:group-hover/dot:border-slate-600 ${isDimmed ? 'opacity-30' : ''}`
                } ${hoverOnly ? 'opacity-0 group-hover/dot:opacity-100' : ''}`}
              >
                {p.gameName}
              </span>
            </div>
          );
        })}
      </div>
      {removed.length > 0 && (
        <p className="text-[10px] text-red-300 mt-1.5">
          Removed: {removed.map((r) => <span key={String(r.gameName)} className="line-through mr-1.5">{String(r.gameName)}</span>)}
        </p>
      )}
    </div>
  );
}
