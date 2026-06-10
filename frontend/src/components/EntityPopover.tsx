import type { AppState, EntityRef, ModuleData } from '../types';
import { PositioningChart } from './ModuleCard';

interface Props {
  entity: EntityRef;
  state: AppState;
  onClose: () => void;
  onNavigate: (entity: EntityRef) => void;
}

/** Cross-module detail card for a competitor or audience segment. */
export function EntityPopover({ entity, state, onClose, onNavigate }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[2px] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[75vh] overflow-y-auto shadow-2xl"
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

const SWOT_CATEGORIES = [
  { key: 'strengths', label: 'S', color: 'text-emerald-600 bg-emerald-50' },
  { key: 'weaknesses', label: 'W', color: 'text-red-500 bg-red-50' },
  { key: 'opportunities', label: 'O', color: 'text-blue-600 bg-blue-50' },
  { key: 'threats', label: 'T', color: 'text-amber-600 bg-amber-50' },
];

/** SWOT items that mention any of the given names. */
function swotMentions(swot: ModuleData | null, names: string[]) {
  if (!swot) return [];
  const result: Array<{ label: string; color: string; text: string }> = [];
  for (const cat of SWOT_CATEGORIES) {
    for (const item of (swot[cat.key] as Array<{ text: string }>) || []) {
      if (names.some((n) => item.text.includes(n))) {
        result.push({ label: cat.label, color: cat.color, text: item.text });
      }
    }
  }
  return result;
}

function MiniMatrix({ state, highlight }: { state: AppState; highlight: string[] }) {
  const pm = state.positioningMatrix.data;
  if (!pm) return null;
  return (
    <div className="h-52 flex flex-col">
      <PositioningChart data={pm} compact highlight={highlight} />
    </div>
  );
}

function CompetitorDetail({ name, state, onNavigate }: { name: string; state: AppState; onNavigate: (e: EntityRef) => void }) {
  const landscape = state.competitiveLandscape.data;
  const competitor = (landscape?.existingCompetitors as Array<{ id: string; name: string; rationale: string }> | undefined)
    ?.find((c) => c.name === name);

  const segments = ((state.audienceOverview.data?.segments as Array<{ segmentName: string; selectedExistingCompetitors: string[] }> | undefined) || [])
    .filter((s) => s.selectedExistingCompetitors.includes(name));

  const inMatrix = ((state.positioningMatrix.data?.positions as Array<{ gameName: string }> | undefined) || [])
    .some((p) => p.gameName === name);

  const mentions = swotMentions(state.swot.data, [name]);

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

      {inMatrix && (
        <Section title="Market position">
          <MiniMatrix state={state} highlight={[name]} />
        </Section>
      )}

      {mentions.length > 0 && (
        <Section title="Mentioned in SWOT">
          <div className="space-y-2">
            {mentions.map((m, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className={`text-[10px] font-bold ${m.color} w-4 h-4 rounded inline-flex items-center justify-center shrink-0 mt-0.5`}>
                  {m.label}
                </span>
                <p className="text-xs text-gray-500 leading-relaxed">{m.text}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function SegmentDetail({ name, state, onNavigate }: { name: string; state: AppState; onNavigate: (e: EntityRef) => void }) {
  const segment = ((state.audienceOverview.data?.segments as Array<{ id: string; segmentName: string; description: string; selectedExistingCompetitors: string[] }> | undefined) || [])
    .find((s) => s.segmentName === name);

  const competitors = segment?.selectedExistingCompetitors || [];
  const mentions = swotMentions(state.swot.data, [name]);

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
              {competitors.map((c) => (
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

          {competitors.length > 0 && state.positioningMatrix.data && (
            <Section title="Where this segment's games sit">
              <MiniMatrix state={state} highlight={competitors} />
              <p className="text-[10px] text-gray-300 mt-1.5">
                Blue dots = games this segment plays. The cluster shows the territory this segment occupies.
              </p>
            </Section>
          )}

          {mentions.length > 0 && (
            <Section title="Mentioned in SWOT">
              <div className="space-y-2">
                {mentions.map((m, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className={`text-[10px] font-bold ${m.color} w-4 h-4 rounded inline-flex items-center justify-center shrink-0 mt-0.5`}>
                      {m.label}
                    </span>
                    <p className="text-xs text-gray-500 leading-relaxed">{m.text}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}
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
