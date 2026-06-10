import { useEffect } from 'react';
import type { ModuleState, ModuleName } from '../types';
import { MODULE_META, StatusDot } from './moduleShared';
import { PositioningChart } from './ModuleCard';

interface Props {
  name: ModuleName;
  module: ModuleState;
  onClose: () => void;
}

export function ModuleDetail({ name, module, onClose }: Props) {
  const meta = MODULE_META[name];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-gray-100 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                {meta.layer}
              </span>
              <StatusDot status={module.status} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">{meta.label}</h2>
            <p className="text-sm text-gray-400 mt-1">{meta.description}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-6 overflow-y-auto">
          {module.data ? <DetailContent name={name} data={module.data} /> : null}
        </div>
      </div>
    </div>
  );
}

function DetailContent({ name, data }: { name: ModuleName; data: Record<string, unknown> }) {
  if (name === 'competitiveLandscape') {
    const competitors = (data.existingCompetitors as Array<{ id: string; name: string; rationale: string }>) || [];
    return (
      <div>
        <Section title="Summary">
          <p className="text-sm text-gray-600 leading-relaxed">{data.summary as string}</p>
        </Section>
        <Section title={`Competitors (${competitors.length})`}>
          <div className="space-y-4">
            {competitors.map((c) => (
              <div key={c.id} className="flex gap-4">
                <span className="text-[10px] font-mono text-gray-300 pt-1 shrink-0 w-12">{c.id}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{c.rationale}</p>
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
    return (
      <div>
        <Section title="Segmentation Logic">
          <p className="text-sm text-gray-600 leading-relaxed">{data.summary as string}</p>
        </Section>
        <Section title={`Segments (${segments.length})`}>
          <div className="space-y-6">
            {segments.map((s) => (
              <div key={s.id} className="border border-gray-100 rounded-xl p-5">
                <p className="text-sm font-semibold text-gray-900">{s.segmentName}</p>
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{s.description}</p>
                <div className="mt-3">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest">Plays</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {s.selectedExistingCompetitors.map((c, j) => (
                      <span key={j} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  if (name === 'positioningMatrix') {
    const xAxis = data.xAxis as { axisName: string; lowLabel: string; highLabel: string };
    const yAxis = data.yAxis as { axisName: string; lowLabel: string; highLabel: string };
    return (
      <div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border border-gray-100 rounded-xl p-4">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest">X Axis</span>
            <p className="text-sm font-semibold text-gray-900 mt-1">{xAxis?.axisName}</p>
            <p className="text-xs text-gray-400 mt-0.5">{xAxis?.lowLabel} → {xAxis?.highLabel}</p>
          </div>
          <div className="border border-gray-100 rounded-xl p-4">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest">Y Axis</span>
            <p className="text-sm font-semibold text-gray-900 mt-1">{yAxis?.axisName}</p>
            <p className="text-xs text-gray-400 mt-0.5">{yAxis?.lowLabel} → {yAxis?.highLabel}</p>
          </div>
        </div>
        <PositioningChart data={data} />
      </div>
    );
  }

  if (name === 'swot') {
    const categories = [
      { key: 'strengths', label: 'Strengths', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
      { key: 'weaknesses', label: 'Weaknesses', color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' },
      { key: 'opportunities', label: 'Opportunities', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
      { key: 'threats', label: 'Threats', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    ];
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map(({ key, label, color, bg, border }) => (
          <div key={key} className={`rounded-xl border ${border} ${bg} p-5`}>
            <p className={`text-sm font-semibold ${color} mb-3`}>{label}</p>
            <div className="space-y-2.5">
              {((data[key] as Array<{ id: string; text: string }>) || []).map((item) => (
                <p key={item.id} className="text-sm text-gray-600 leading-relaxed">
                  {item.text}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3">{title}</h3>
      {children}
    </div>
  );
}
