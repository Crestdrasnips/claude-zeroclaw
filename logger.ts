// logger.ts — Structured logger for ZeroClaw Claude daemon

import fs from 'fs';
import { LOG_FILE, ensureConfigDir } from '../config.js';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const COLORS: Record<Level, string> = {
  debug: '\x1b[90m',   // dim gray
  info:  '\x1b[36m',   // cyan
  warn:  '\x1b[33m',   // yellow
  error: '\x1b[31m',   // red
};
const RESET = '\x1b[0m';

const MIN_LEVEL: Level = (process.env.LOG_LEVEL as Level) ?? 'info';

function write(level: Level, msg: string): void {
  if (LEVELS[level] < LEVELS[MIN_LEVEL]) return;

  const ts  = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase().padEnd(5)}] ${msg}`;

  // Console output with color
  const colored = `${COLORS[level]}${line}${RESET}`;
  if (level === 'error' || level === 'warn') {
    console.error(colored);
  } else {
    console.log(colored);
  }

  // File output
  try {
    ensureConfigDir();
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {
    // Non-fatal
  }
}

export const log = {
  debug: (msg: string) => write('debug', msg),
  info:  (msg: string) => write('info',  msg),
  warn:  (msg: string) => write('warn',  msg),
  error: (msg: string) => write('error', msg),
};
