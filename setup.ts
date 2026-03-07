#!/usr/bin/env tsx
// setup.ts — Interactive setup wizard for ZeroClaw Claude

import chalk from 'chalk';
import * as readline from 'readline';
import { loadConfig, saveConfig, ensureConfigDir } from './config.js';
import type { ZeroClawConfig, ModelId, SecurityLevel } from './types.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (question: string, def?: string): Promise<string> =>
  new Promise(resolve => {
    const hint = def ? chalk.dim(` [${def}]`) : '';
    rl.question(`${question}${hint}: `, (ans) => resolve(ans.trim() || def || ''));
  });

const askBool = async (question: string, def = false): Promise<boolean> => {
  const ans = await ask(question, def ? 'y' : 'n');
  return ans.toLowerCase().startsWith('y');
};

const BANNER = `
${chalk.cyan.bold('╔══════════════════════════════════════════════════╗')}
${chalk.cyan.bold('║  ⚡  ZEROCLAW CLAUDE — Setup Wizard              ║')}
${chalk.cyan.bold('║     Claude Code daemon for macOS                 ║')}
${chalk.cyan.bold('╚══════════════════════════════════════════════════╝')}
`;

async function main(): Promise<void> {
  console.log(BANNER);
  ensureConfigDir();
  const config = loadConfig();

  console.log(chalk.dim('Answer each question. Press Enter to accept the default.\n'));

  // ── Model ──────────────────────────────────────────────────────────────────
  console.log(chalk.cyan.bold('── Model ─────────────────────────────────────────'));
  console.log(chalk.dim('  1) claude-sonnet-4-6  (fast, balanced)'));
  console.log(chalk.dim('  2) claude-opus-4-6    (most capable)'));
  console.log(chalk.dim('  3) claude-haiku-4-5-20251001  (fastest, cheapest)'));
  const modelChoice = await ask('Choose model [1-3]', '1');
  const models: Record<string, ModelId> = {
    '1': 'claude-sonnet-4-6',
    '2': 'claude-opus-4-6',
    '3': 'claude-haiku-4-5-20251001',
  };
  config.model = models[modelChoice] ?? 'claude-sonnet-4-6';

  // ── Security ───────────────────────────────────────────────────────────────
  console.log(chalk.cyan.bold('\n── Security ──────────────────────────────────────'));
  console.log(chalk.dim('  readonly  — no write, no shell'));
  console.log(chalk.dim('  standard  — files + web, no shell exec'));
  console.log(chalk.dim('  elevated  — files + web + shell (default)'));
  console.log(chalk.dim('  full      — all tools, bypassPermissions'));
  const secChoice = await ask('Security level', 'elevated');
  config.security = (secChoice as SecurityLevel) || 'elevated';

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  console.log(chalk.cyan.bold('\n── Heartbeat ─────────────────────────────────────'));
  config.heartbeat.enabled = await askBool('Enable heartbeat check-ins?', false);
  if (config.heartbeat.enabled) {
    const intv = await ask('Interval (minutes)', '60');
    config.heartbeat.intervalMin = parseInt(intv) || 60;
    const qStart = await ask('Quiet hours start (0-23)', '23');
    const qEnd   = await ask('Quiet hours end (0-23)', '8');
    config.heartbeat.quietHoursStart = parseInt(qStart) || 23;
    config.heartbeat.quietHoursEnd   = parseInt(qEnd)   || 8;
    const prompt = await ask('Heartbeat prompt', config.heartbeat.prompt);
    config.heartbeat.prompt = prompt;
  }

  // ── Telegram ──────────────────────────────────────────────────────────────
  console.log(chalk.cyan.bold('\n── Telegram Bot ──────────────────────────────────'));
  config.telegram.enabled = await askBool('Enable Telegram bot?', false);
  if (config.telegram.enabled) {
    console.log(chalk.dim('  Create bot: https://t.me/BotFather → /newbot'));
    config.telegram.token = await ask('Bot token');
    console.log(chalk.dim('  Get your chat ID: https://t.me/userinfobot'));
    config.telegram.chatId = await ask('Your chat ID (numeric)');
    config.telegram.allowVoice = await askBool('Allow voice messages?', true);
    if (config.telegram.allowVoice) {
      console.log(chalk.dim('  For voice transcription: https://console.groq.com'));
      config.telegram.groqApiKey = await ask('Groq API key (optional)', '');
    }
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  console.log(chalk.cyan.bold('\n── Web Dashboard ─────────────────────────────────'));
  const port = await ask('Dashboard port', String(config.dashboardPort));
  config.dashboardPort = parseInt(port) || 3742;

  // ── Save ──────────────────────────────────────────────────────────────────
  saveConfig(config);

  console.log('\n' + chalk.green.bold('✅ Configuration saved!'));
  console.log(chalk.dim(`   Config: ~/.zeroclaw-claude/config.json`));
  console.log();
  console.log(chalk.cyan.bold('Next steps:'));
  console.log(chalk.white('  npm start              ') + chalk.dim('# Start daemon'));
  console.log(chalk.white(`  open http://127.0.0.1:${config.dashboardPort}  `) + chalk.dim('# Web dashboard'));
  if (config.telegram.enabled) {
    console.log(chalk.white('  Telegram: send /start  ') + chalk.dim('# to your bot'));
  }
  console.log();

  rl.close();
}

main().catch((err) => {
  console.error(chalk.red('Setup failed:'), err.message);
  rl.close();
  process.exit(1);
});
