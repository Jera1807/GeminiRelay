// ─── Database entity types ─────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface Run {
  id: string;
  conversationId: string;
  messageId: string | null;
  status: 'running' | 'finished' | 'cancelled' | 'error';
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  model: string | null;
  createdAt: string;
  finishedAt: string | null;
}

// ─── REST API DTOs ─────────────────────────────────────────────────────────
export interface RegisterDto {
  username: string;
  password: string;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: { id: string; username: string };
}

export interface CreateConversationDto {
  title?: string;
}

export interface ApiConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  run?: {
    id: string;
    status: string;
    durationMs: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    model: string | null;
  };
}

// ─── WebSocket message types ────────────────────────────────────────────────
// Client → Server
export type ClientMessage =
  | StartRunMessage
  | CancelRunMessage;

export interface StartRunMessage {
  type: 'startRun';
  conversationId: string;
  prompt: string;
}

export interface CancelRunMessage {
  type: 'cancelRun';
  runId: string;
}

// Server → Client
export type ServerMessage =
  | RunStartedMessage
  | GeminiEventMessage
  | LogLineMessage
  | RunFinishedMessage
  | RunErrorMessage;

export interface RunStartedMessage {
  type: 'runStarted';
  runId: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
}

export interface GeminiEventMessage {
  type: 'geminiEvent';
  runId: string;
  event: GeminiStreamEvent;
}

export interface LogLineMessage {
  type: 'logLine';
  runId: string;
  line: string;
}

export interface RunFinishedMessage {
  type: 'runFinished';
  runId: string;
  stats: RunStats | null;
}

export interface RunErrorMessage {
  type: 'runError';
  runId: string;
  error: string;
}

// ─── Gemini stream-json event types ────────────────────────────────────────
export interface GeminiStreamEvent {
  type: string;
  delta?: boolean;
  text?: string;
  stats?: RunStats;
  [key: string]: unknown;
}

export interface RunStats {
  durationMs?: number;
  inputTokenCount?: number;
  outputTokenCount?: number;
  model?: string;
  totalTokenCount?: number;
}
