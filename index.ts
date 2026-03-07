// index.ts — ZeroClaw Claude daemon entry point

import fs from 'fs';
import { loadConfig, PID_FILE, ensureConfigDir } from './config.js';
import { startScheduler, stopScheduler } from './scheduler/index.js';
import { startHeartbeat, stopHeartbeat } from './daemon/heartbeat.js';
import { startTelegramBot, stopTelegramBot } from './bot/telegram.js';
import { startDashboard, stopDashboard } from './dashboard/server.js';
import { log } from './daemon/logger.js';

const BANNER = `
  ╔══════════════════════════════════════════════════╗
  ║  ⚡  Z E R O C L A W  —  C L A U D E            ║
  ║     Daemon for Claude Code · v1.0.0             ║
  ╚══════════════════════════════════════════════════╝
`;

async function main(): Promise<void> {
  console.log(BANNER);

  ensureConfigDir();

  // Write PID file
  fs.writeFileSync(PID_FILE, String(process.pid), 'utf-8');

  const config = loadConfig();
  log.info(`Starting ZeroClaw Claude daemon`);
  log.info(`Model: ${config.model} | Security: ${config.security}`);

  // Start subsystems
  startScheduler();
  startHeartbeat();
  await startTelegramBot();
  startDashboard();

  log.info(`Dashboard: http://127.0.0.1:${config.dashboardPort}`);
  log.info(`Daemon ready — PID ${process.pid}`);

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    log.info(`Received ${signal} — shutting down...`);
    stopHeartbeat();
    stopScheduler();
    await stopTelegramBot();
    stopDashboard();
    try { fs.unlinkSync(PID_FILE); } catch {}
    log.info('ZeroClaw Claude stopped.');
    process.exit(0);
  };

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => {
    log.error(`Uncaught exception: ${err.message}`);
  });
  process.on('unhandledRejection', (reason) => {
    log.error(`Unhandled rejection: ${reason}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
