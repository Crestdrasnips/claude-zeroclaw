// types.ts — Shared types for ZeroClaw Claude

export type ModelId =
  | 'claude-opus-4-5'
  | 'claude-sonnet-4-5'
  | 'claude-haiku-4-5-20251001'
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-6';

export type SecurityLevel = 'readonly' | 'standard' | 'elevated' | 'full';

export interface ZeroClawConfig {
  model:          ModelId;
  heartbeat: {
    enabled:      boolean;
    intervalMin:  number;
    quietHoursStart: number; // 0-23
    quietHoursEnd:   number; // 0-23
    prompt:       string;
  };
  telegram: {
    enabled:      boolean;
    token:        string;
    chatId:       string;
    allowVoice:   boolean;
    groqApiKey:   string; // for Whisper transcription
  };
  security:       SecurityLevel;
  dashboardPort:  number;
  sessionId:      string | null;
  workdir:        string;
}

export interface CronJob {
  id:          string;
  name:        string;
  schedule:    string;   // standard cron syntax
  prompt:      string;
  model:       ModelId;
  timezone:    string;
  enabled:     boolean;
  lastRun:     number | null;
  nextRun:     number | null;
  createdAt:   number;
}

export interface RunRecord {
  id:          string;
  jobId:       string | null;  // null = Telegram-triggered
  source:      'cron' | 'telegram' | 'heartbeat' | 'manual';
  prompt:      string;
  response:    string;
  model:       ModelId;
  startedAt:   number;
  finishedAt:  number;
  durationMs:  number;
  success:     boolean;
  error:       string | null;
  tokensIn:    number;
  tokensOut:   number;
}

export interface MemoryEntry {
  id:          string;
  content:     string;
  salience:    number;   // 0..1
  createdAt:   number;
  sessionId:   string;
  tags:        string[];
}

export interface OutboxMessage {
  id:          string;
  chatId:      string;
  text:        string;
  createdAt:   number;
  sentAt:      number | null;
  retries:     number;
}

export interface AgentResult {
  response:    string;
  sessionId:   string;
  tokensIn:    number;
  tokensOut:   number;
  durationMs:  number;
  success:     boolean;
  error?:      string;
}

export interface DashboardStats {
  totalRuns:      number;
  successRate:    number;
  totalTokensIn:  number;
  totalTokensOut: number;
  uptime:         number;
  activeJobs:     number;
  memoryEntries:  number;
  lastRun:        number | null;
}
