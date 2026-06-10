import { useState, useEffect } from 'react';
import type { ModuleState, ModuleName, ModuleData, ModuleChanges, EntityRef } from '../types';
import { MODULE_META, StatusDot, fieldChanges, NewBadge, RemovedTag, EntityText, moduleToQuote, QuoteButton } from './moduleShared';
import type { EntityContext } from './moduleShared';
import { PositioningChart } from './ModuleCard';

interface Props {
  name: ModuleName;
  module: ModuleState;
  onClose: () => void;
  onEntityClick: (entity: EntityRef) => void;
  ctx?: EntityContext;
  pmLens?: number;
  onSelectLens?: (lens: number) => void;
  onQuote?: (text: string) => void;
}

export function ModuleDetail({ name, module, onClose, onEntityClick, ctx, pmLens = 0, onSelectLens, onQuote }: Props) {
  const meta = MODULE_META[name];
  const [versions, setVersions] = useState<Array<{ ts: number; data: ModuleData }>>([]);
  const [versionIdx, setVersionIdx] = useState(-1); // -1 = current

  useEffect(() => {
    fetch(`/api/modules/${name}/versions`)
      .then((r) => r.json())
      .then((d) => setVersions(d.versions || []))
      .catch(() => setVersions([]));
  }, [name, module.data]);

  const viewingOld = versionIdx >= 0 && versions[versionIdx];
  const displayData = viewingOld ? versions[versionIdx].data : module.data;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-gray-100 dark:border-slate-800 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800/60 px-1.5 py-0.5 rounded">
                {meta.layer}
              </span>
              <StatusDot status={module.status} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">{meta.label}</h2>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">{meta.description}</p>
            {versions.length > 0 && (
              <div className="flex items-center gap-2 mt-2.5">
                <select
                  value={versionIdx}
                  onChange={(e) => setVersionIdx(Number(e.target.value))}
                  className="appearance-none text-[11px] text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-md px-2 py-1 cursor-pointer hover:border-gray-300 dark:hover:border-slate-500 focus:outline-none"
                >
                  <option value={-1}>Current version</option>
                  {versions.map((v, i) => (
                    <option key={i} value={i}>
                      {new Date(v.ts * 1000).toLocaleString()} {i === 0 ? '(previous)' : ''}
                    </option>
                  ))}
                </select>
                {viewingOld && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 rounded-full px-2 py-0.5">
                    Viewing an earlier generation — read-only
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
          {module.data && onQuote && (
            <QuoteButton onClick={() => onQuote(moduleToQuote(name, module.data!))} />
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700/60 flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          </div>
        </div>

        {/* Body */}
        <div className={`px-8 py-6 overflow-y-auto ${viewingOld ? 'opacity-80' : ''}`}>
          {displayData ? (
            <DetailContent
              name={name}
              data={displayData}
              changes={viewingOld ? undefined : module.changes}
              onEntityClick={onEntityClick}
              ctx={ctx}
              pmLens={pmLens}
              onSelectLens={onSelectLens}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface ContentProps {
  name: ModuleName;
  data: ModuleData;
  changes?: ModuleChanges | null;
  onEntityClick: (entity: EntityRef) => void;
  ctx?: EntityContext;
  pmLens?: number;
  onSelectLens?: (lens: number) => void;
}

function DetailContent({ name, data, changes, onEntityClick, ctx, pmLens = 0, onSelectLens }: ContentProps) {
  if (name === 'competitiveLandscape') {
    const competitors = (data.existingCompetitors as Array<{ id: string; name: string; rationale: string }>) || [];
    const { added, removed } = fieldChanges(changes, 'existingCompetitors');
    return (
      <div>
        <Section title="Summary">
          <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">{data.summary as string}</p>
        </Section>
        <Section title={`Competitors (${competitors.length})`}>
          <div className="space-y-4">
            {competitors.map((c) => (
              <div key={c.id} className="flex gap-4">
                <span className="text-[10px] font-mono text-gray-300 dark:text-slate-600 pt-1 shrink-0 w-12">{c.id}</span>
                <div>
                  <button
                    onClick={() => onEntityClick({ kind: 'competitor', name: c.name })}
                    className="text-sm font-semibold text-gray-900 dark:text-slate-100 hover:underline underline-offset-2 decoration-gray-300 dark:decoration-slate-500"
                  >
                    {c.name}
                  </button>
                  {added.has(c.name) && <span className="ml-2 inline-block align-middle"><NewBadge /></span>}
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed">{c.rationale}</p>
                </div>
              </div>
            ))}
            {removed.map((c, i) => (
              <div key={`removed-${i}`} className="flex gap-4 opacity-50">
                <span className="text-[10px] font-mono text-red-200 pt-1 shrink-0 w-12">{String(c.id ?? '')}</span>
                <div>
                  <span className="align-middle text-sm font-semibold text-red-400 line-through">{String(c.name)}</span>
                  <span className="ml-2"><RemovedTag /></span>
                  <p className="text-sm text-gray-400 dark:text-slate-500 line-through mt-0.5 leading-relaxed">{String(c.rationale ?? '')}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  if (name === 'audienceOverview') {
    const segments = (data.segments as Array<{ id: string; segmentName: string; description: string; selectedExistingCompetitors: string[] }>) || [];
    const { added, removed } = fieldChanges(changes, 'segments');
    return (
      <div>
        <Section title="Segmentation Logic">
          <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">{data.summary as string}</p>
        </Section>
        <Section title={`Segments (${segments.length})`}>
          <div className="space-y-6">
            {segments.map((s) => (
              <div key={s.id} className="border border-gray-100 dark:border-slate-800 rounded-xl p-5">
                <button
                  onClick={() => onEntityClick({ kind: 'segment', name: s.segmentName })}
                  className="text-sm font-semibold text-gray-900 dark:text-slate-100 hover:underline underline-offset-2 decoration-gray-300 dark:decoration-slate-500"
                >
                  {s.segmentName}
                </button>
                {added.has(s.segmentName) && <span className="ml-2 inline-block align-middle"><NewBadge /></span>}
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1.5 leading-relaxed">{s.description}</p>
                <div className="mt-3">
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-widest">Plays</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {s.selectedExistingCompetitors.map((c, j) => (
                      <button
                        key={j}
                        onClick={() => onEntityClick({ kind: 'competitor', name: c })}
                        className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 px-2.5 py-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {removed.map((s, i) => (
              <div key={`removed-${i}`} className="border border-red-50 dark:border-red-950 rounded-xl p-5 opacity-50">
                <span className="align-middle text-sm font-semibold text-red-400 line-through">{String(s.segmentName)}</span>
                <span className="ml-2"><RemovedTag /></span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  if (name === 'positioningMatrix') {
    return <PositioningDetail data={data} changes={changes} onEntityClick={onEntityClick} selected={pmLens} onSelect={onSelectLens} />;
  }

  if (name === 'swot') {
    return <SwotQuadrant data={data} changes={changes} onEntityClick={onEntityClick} ctx={ctx} />;
  }

  return null;
}

interface ViewLike {
  xAxis: { axisName: string; lowLabel: string; highLabel: string };
  yAxis: { axisName: string; lowLabel: string; highLabel: string };
  positions: Array<{ id: string; gameName: string; xPosition: number; yPosition: number }>;
}

/** Positioning with selectable axis lenses (primary + alternatives).
 *  Selection is lifted to Canvas so the card preview follows it. */
function PositioningDetail({ data, changes, onEntityClick, selected = 0, onSelect }: { data: ModuleData; changes?: ModuleChanges | null; onEntityClick: (e: EntityRef) => void; selected?: number; onSelect?: (lens: number) => void }) {
  const primary: ViewLike = {
    xAxis: data.xAxis as ViewLike['xAxis'],
    yAxis: data.yAxis as ViewLike['yAxis'],
    positions: data.positions as ViewLike['positions'],
  };
  const alternatives = (data.alternativeViews as ViewLike[] | undefined) || [];
  const views = [primary, ...alternatives];
  const view = views[selected] ?? primary;

  return (
    <div>
      {views.length > 1 && (
        <div className="flex gap-1.5 mb-5 flex-wrap">
          {views.map((v, i) => (
            <button
              key={i}
              onClick={() => onSelect?.(i)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                i === selected
                  ? 'bg-black text-white dark:bg-slate-200 dark:text-slate-900 border-black dark:border-slate-200'
                  : 'bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-400'
              }`}
            >
              {v.xAxis?.axisName} × {v.yAxis?.axisName}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border border-gray-100 dark:border-slate-800 rounded-xl p-4">
          <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-widest">X Axis</span>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">{view.xAxis?.axisName}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{view.xAxis?.lowLabel} → {view.xAxis?.highLabel}</p>
        </div>
        <div className="border border-gray-100 dark:border-slate-800 rounded-xl p-4">
          <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-widest">Y Axis</span>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-1">{view.yAxis?.axisName}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{view.yAxis?.lowLabel} → {view.yAxis?.highLabel}</p>
        </div>
      </div>
      <PositioningChart
        data={view as unknown as ModuleData}
        changes={selected === 0 ? changes : undefined}
        onEntityClick={onEntityClick}
      />
    </div>
  );
}

/** Classic SWOT 2x2 quadrant: Internal/External × Helpful/Harmful. */
function SwotQuadrant({ data, changes, onEntityClick, ctx }: { data: ModuleData; changes?: ModuleChanges | null; onEntityClick: (e: EntityRef) => void; ctx?: EntityContext }) {
  const quadrants = [
    { key: 'strengths', label: 'Strengths', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50/70 dark:bg-emerald-950/30', border: 'border-emerald-100 dark:border-emerald-900', dot: 'bg-emerald-500' },
    { key: 'weaknesses', label: 'Weaknesses', color: 'text-red-600 dark:text-red-300', bg: 'bg-red-50/70 dark:bg-red-950/30', border: 'border-red-100 dark:border-red-900', dot: 'bg-red-400' },
    { key: 'opportunities', label: 'Opportunities', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50/70 dark:bg-blue-950/30', border: 'border-blue-100 dark:border-blue-900', dot: 'bg-blue-500' },
    { key: 'threats', label: 'Threats', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50/70 dark:bg-amber-950/30', border: 'border-amber-100 dark:border-amber-900', dot: 'bg-amber-500' },
  ];

  return (
    <div>
      {/* Axis annotations: columns = Helpful/Harmful, rows = Internal/External */}
      <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
        <div />
        <p className="text-center text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Helpful</p>
        <p className="text-center text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Harmful</p>

        <div className="flex items-center">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest -rotate-90 whitespace-nowrap origin-center w-4">Internal</p>
        </div>
        {quadrants.slice(0, 2).map((q) => (
          <SwotCell key={q.key} q={q} data={data} changes={changes} onEntityClick={onEntityClick} ctx={ctx} />
        ))}

        <div className="flex items-center">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest -rotate-90 whitespace-nowrap origin-center w-4">External</p>
        </div>
        {quadrants.slice(2, 4).map((q) => (
          <SwotCell key={q.key} q={q} data={data} changes={changes} onEntityClick={onEntityClick} ctx={ctx} />
        ))}
      </div>
      <p className="text-[10px] text-gray-300 dark:text-slate-600 mt-4">
        Tip: dotted-underlined names are clickable — they open the cross-module detail card.
      </p>
    </div>
  );
}

function SwotCell({ q, data, changes, onEntityClick, ctx }: {
  q: { key: string; label: string; color: string; bg: string; border: string; dot: string };
  data: ModuleData;
  changes?: ModuleChanges | null;
  onEntityClick: (e: EntityRef) => void;
  ctx?: EntityContext;
}) {
  const items = (data[q.key] as Array<{ id: string; text: string }>) || [];
  const { added, removed } = fieldChanges(changes, q.key);

  return (
    <div className={`rounded-xl border ${q.border} ${q.bg} p-4`}>
      <div className="flex items-center justify-between mb-2.5">
        <p className={`text-sm font-semibold ${q.color}`}>{q.label}</p>
        <span className="text-[10px] text-gray-400 dark:text-slate-500 bg-white/70 dark:bg-slate-800/70 rounded-full px-2 py-0.5">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex gap-2 items-start">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${q.dot}`} />
            <p className="text-[13px] text-gray-600 dark:text-slate-300 leading-relaxed">
              <EntityText text={item.text} ctx={ctx} onEntityClick={onEntityClick} />
              {added.has(item.text) && <span className="ml-1.5"><NewBadge /></span>}
            </p>
          </div>
        ))}
        {removed.map((item, i) => (
          <div key={`removed-${i}`} className="flex gap-2 items-start opacity-60">
            <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-red-200" />
            <p className="text-[13px] text-red-300 line-through leading-relaxed">{String(item.text)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">{title}</h3>
      {children}
    </div>
  );
}
