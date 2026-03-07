// heartbeat.ts — Periodic heartbeat daemon for ZeroClaw Claude

import { loadConfig } from '../config.js';
import { runAgent } from '../agent/runner.js';
import { outbox } from '../db.js';
import { log } from './logger.js';

let heartbeatTimer: NodeJS.Timeout | null = null;

export function startHeartbeat(): void {
  const config = loadConfig();
  if (!config.heartbeat.enabled) {
    log.debug('Heartbeat disabled');
    return;
  }

  const intervalMs = config.heartbeat.intervalMin * 60 * 1000;
  log.info(`Heartbeat every ${config.heartbeat.intervalMin}min`);

  const run = async () => {
    const cfg = loadConfig();
    if (isQuietHours(cfg.heartbeat.quietHoursStart, cfg.heartbeat.quietHoursEnd)) {
      log.debug('Heartbeat skipped — quiet hours');
      return;
    }

    log.info('Running heartbeat...');
    const result = await runAgent(cfg.heartbeat.prompt, {
      source:        'heartbeat',
      resumeSession: true,
    });

    // If Telegram is configured, send the heartbeat response
    if (cfg.telegram.enabled && cfg.telegram.chatId && result.response.trim()) {
      outbox.push(cfg.telegram.chatId, `💓 Heartbeat\n\n${result.response}`);
    }

    log.info(`Heartbeat done — ${result.durationMs}ms`);
  };

  heartbeatTimer = setInterval(run, intervalMs);

  // Run once on start
  setTimeout(run, 5000);
}

export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function isQuietHours(start: number, end: number): boolean {
  const hour = new Date().getHours();
  if (start <= end) {
    return hour >= start && hour < end;
  }
  // Wraps midnight
  return hour >= start || hour < end;
}
