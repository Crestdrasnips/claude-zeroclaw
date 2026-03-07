// config.ts — Load, validate, and persist ZeroClaw config

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { ZeroClawConfig } from './types.js';

export const CONFIG_DIR  = path.join(os.homedir(), '.zeroclaw-claude');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
export const DB_FILE     = path.join(CONFIG_DIR, 'zeroclaw.db');
export const LOG_FILE    = path.join(CONFIG_DIR, 'zeroclaw.log');
export const PID_FILE    = path.join(CONFIG_DIR, 'daemon.pid');

export const DEFAULT_CONFIG: ZeroClawConfig = {
  model: 'claude-sonnet-4-6',
  heartbeat: {
    enabled:         false,
    intervalMin:     60,
    quietHoursStart: 23,
    quietHoursEnd:   8,
    prompt:          'Check in: any urgent tasks, reminders, or things I should know about right now?',
  },
  telegram: {
    enabled:   false,
    token:     '',
    chatId:    '',
    allowVoice: true,
    groqApiKey: '',
  },
  security:      'standard',
  dashboardPort: 3742,
  sessionId:     null,
  workdir:       process.cwd(),
};

export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): ZeroClawConfig {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    return { ...DEFAULT_CONFIG, ...raw };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: ZeroClawConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function updateConfig(partial: Partial<ZeroClawConfig>): ZeroClawConfig {
  const config = loadConfig();
  const updated = { ...config, ...partial };
  saveConfig(updated);
  return updated;
}
