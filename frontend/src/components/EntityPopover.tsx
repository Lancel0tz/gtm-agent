import { useEffect } from 'react';
import type { AppState, EntityRef } from '../types';

interface Props {
  entity: EntityRef;
  state: AppState;
  onClose: () => void;
  onNavigate: (entity: EntityRef) => void;
}

/** Cross-module detail card for a competitor or audience segment. */
export function EntityPopover({ entity, state, onClose, onNavigate }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[2px] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[70vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {entity.kind === 'competitor' ? (
          <CompetitorDetail name={entity.name} state={state} onNavigate={onNavigate} />
        ) : (
          <SegmentDetail name={entity.name} state={state} onNavigate={onNavigate} />
        )}
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}

function CompetitorDetail({ name, state, onNavigate }: { name: string; state: AppState; onNavigate: (e: EntityRef) => void }) {
  const landscape = state.competitiveLandscape.data;
  const competitor = (landscape?.existingCompetitors as Array<{ id: string; name: string; rationale: string }> | undefined)
    ?.find((c) => c.name === name);

  const segments = ((state.audienceOverview.data?.segments as Array<{ segmentName: string; selectedExistingCompetitors: string[] }> | undefined) || [])
    .filter((s) => s.selectedExistingCompetitors.includes(name));

  const position = ((state.positioningMatrix.data?.positions as Array<{ gameName: string; xPosition: number; yPosition: number }> | undefined) || [])
    .find((p) => p.gameName === name);
  const xAxis = state.positioningMatrix.data?.xAxis as { axisName: string } | undefined;
  const yAxis = state.positioningMatrix.data?.yAxis as { axisName: string } | undefined;

  return (
    <div className="px-6 pt-6 pb-3">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Competitor</span>
      <h3 className="text-lg font-semibold text-gray-900 mt-1">{name}</h3>

      {competitor ? (
        <Section title="Why it competes">
          <p className="text-sm text-gray-600 leading-relaxed">{competitor.rationale}</p>
        </Section>
      ) : (
        <p className="text-sm text-gray-400 italic mt-3">Not in the current competitive landscape.</p>
      )}

      {segments.length > 0 && (
        <Section title="Played by segments">
          <div className="flex flex-wrap gap-1.5">
            {segments.map((s) => (
              <button
                key={s.segmentName}
                onClick={() => onNavigate({ kind: 'segment', name: s.segmentName })}
                className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full hover:bg-gray-200 transition-colors"
              >
                {s.segmentName}
              </button>
            ))}
          </div>
        </Section>
      )}

      {position && (
        <Section title="Positioning">
          <div className="flex gap-4 text-sm text-gray-600">
            <span>{xAxis?.axisName}: <b className="text-gray-900">{position.xPosition}</b>/10</span>
            <span>{yAxis?.axisName}: <b className="text-gray-900">{position.yPosition}</b>/10</span>
          </div>
        </Section>
      )}
    </div>
  );
}

function SegmentDetail({ name, state, onNavigate }: { name: string; state: AppState; onNavigate: (e: EntityRef) => void }) {
  const segment = ((state.audienceOverview.data?.segments as Array<{ id: string; segmentName: string; description: string; selectedExistingCompetitors: string[] }> | undefined) || [])
    .find((s) => s.segmentName === name);

  return (
    <div className="px-6 pt-6 pb-3">
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Audience Segment</span>
      <h3 className="text-lg font-semibold text-gray-900 mt-1">{name}</h3>

      {segment ? (
        <>
          <Section title="Profile">
            <p className="text-sm text-gray-600 leading-relaxed">{segment.description}</p>
          </Section>
          <Section title="Currently plays">
            <div className="flex flex-wrap gap-1.5">
              {segment.selectedExistingCompetitors.map((c) => (
                <button
                  key={c}
                  onClick={() => onNavigate({ kind: 'competitor', name: c })}
                  className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full hover:bg-gray-200 transition-colors"
                >
                  {c}
                </button>
              ))}
            </div>
          </Section>
        </>
      ) : (
        <p className="text-sm text-gray-400 italic mt-3">Not in the current audience overview.</p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{title}</h4>
      {children}
    </div>
  );
}
