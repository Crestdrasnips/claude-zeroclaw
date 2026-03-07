#!/usr/bin/env tsx
// status.ts — ZeroClaw Claude health check

import fs from 'fs';
import chalk from 'chalk';
import { loadConfig, PID_FILE, DB_FILE, CONFIG_FILE } from './config.js';
import { runs, jobs, memory } from './db.js';

function check(label: string, ok: boolean, detail = ''): void {
  const icon   = ok ? chalk.green('✅') : chalk.red('❌');
  const status = ok ? chalk.green('OK') : chalk.red('FAIL');
  console.log(`  ${icon}  ${label.padEnd(28)} ${status}  ${chalk.dim(detail)}`);
}

async function main(): Promise<void> {
  console.log(chalk.cyan.bold('\n⚡ ZeroClaw Claude — Status\n'));

  const config = loadConfig();

  // ── Config ──────────────────────────────────────────────────────────────────
  console.log(chalk.bold('Config'));
  check('config.json exists',    fs.existsSync(CONFIG_FILE), CONFIG_FILE);
  check('database exists',       fs.existsSync(DB_FILE),     DB_FILE);
  check('model configured',      !!config.model,              config.model);
  check('security level',        true,                        config.security);

  // ── Daemon ──────────────────────────────────────────────────────────────────
  console.log(chalk.bold('\nDaemon'));
  let daemonRunning = false;
  if (fs.existsSync(PID_FILE)) {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim());
    try {
      process.kill(pid, 0);
      daemonRunning = true;
      check('daemon running', true, `PID ${pid}`);
    } catch {
      check('daemon running', false, `stale PID ${pid}`);
    }
  } else {
    check('daemon running', false, 'not started');
  }

  // ── Claude CLI ──────────────────────────────────────────────────────────────
  console.log(chalk.bold('\nClaude CLI'));
  try {
    const { execSync } = await import('child_process');
    const ver = execSync('claude --version 2>/dev/null', { encoding: 'utf-8' }).trim();
    check('claude CLI installed', true, ver);
  } catch {
    check('claude CLI installed', false, 'run: npm install -g @anthropic-ai/claude-code');
  }

  // ── Integrations ─────────────────────────────────────────────────────────────
  console.log(chalk.bold('\nIntegrations'));
  check('heartbeat enabled', config.heartbeat.enabled,
    config.heartbeat.enabled ? `every ${config.heartbeat.intervalMin}min` : 'disabled');
  check('telegram configured', !!config.telegram.token,
    config.telegram.enabled ? `chat: ${config.telegram.chatId}` : 'disabled');
  check('dashboard port', true, `http://127.0.0.1:${config.dashboardPort}`);

  // ── Stats ─────────────────────────────────────────────────────────────────────
  console.log(chalk.bold('\nStats'));
  const s = runs.stats();
  const j = jobs.list();
  console.log(`  Runs:         ${s.total} total, ${(s.successRate * 100).toFixed(0)}% success`);
  console.log(`  Tokens:       ${(s.tokensIn + s.tokensOut).toLocaleString()} total`);
  console.log(`  Cron jobs:    ${j.length} (${j.filter(x => x.enabled).length} active)`);
  console.log(`  Memory:       ${memory.count()} entries`);
  if (s.lastRun) {
    console.log(`  Last run:     ${new Date(s.lastRun).toLocaleString()}`);
  }

  console.log();
}

main().catch(console.error);
