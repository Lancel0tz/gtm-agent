export type ModuleStatus = 'idle' | 'pending' | 'generating' | 'done';

export type ModuleData = Record<string, unknown>;

/** Accumulated change log across chat rounds, maintained by the backend */
export interface ModuleChanges {
  added: Record<string, string[]>;
  removed: Record<string, Array<Record<string, unknown>>>;
}

export interface ModuleState {
  status: ModuleStatus;
  data: ModuleData | null;
  /** What has been added/removed across all chat interactions */
  changes?: ModuleChanges | null;
}

export interface AppState {
  competitiveLandscape: ModuleState;
  audienceOverview: ModuleState;
  positioningMatrix: ModuleState;
  swot: ModuleState;
}

export interface GameInput {
  title: string;
  genre: string;
  platform: string;
  price: string;
  shortDescription: string;
  filename?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ModuleName = 'competitiveLandscape' | 'audienceOverview' | 'positioningMatrix' | 'swot';

/** A clickable entity inside a module (competitor or audience segment) */
export interface EntityRef {
  kind: 'competitor' | 'segment';
  name: string;
}
