export type ModuleStatus = 'idle' | 'pending' | 'generating' | 'done';

export interface ModuleState {
  status: ModuleStatus;
  data: Record<string, unknown> | null;
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
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ModuleName = 'competitiveLandscape' | 'audienceOverview' | 'positioningMatrix' | 'swot';
