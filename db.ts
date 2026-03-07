// db.ts — SQLite database layer for ZeroClaw Claude

import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { DB_FILE } from './config.js';
import type { CronJob, RunRecord, MemoryEntry, OutboxMessage, ModelId } from './types.js';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_FILE);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    migrate(_db);
  }
  return _db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cron_jobs (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      schedule    TEXT NOT NULL,
      prompt      TEXT NOT NULL,
      model       TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
      timezone    TEXT NOT NULL DEFAULT 'UTC',
      enabled     INTEGER NOT NULL DEFAULT 1,
      last_run    INTEGER,
      next_run    INTEGER,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS run_records (
      id          TEXT PRIMARY KEY,
      job_id      TEXT,
      source      TEXT NOT NULL,
      prompt      TEXT NOT NULL,
      response    TEXT NOT NULL DEFAULT '',
      model       TEXT NOT NULL,
      started_at  INTEGER NOT NULL,
      finished_at INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      success     INTEGER NOT NULL DEFAULT 0,
      error       TEXT,
      tokens_in   INTEGER NOT NULL DEFAULT 0,
      tokens_out  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS memory (
      id          TEXT PRIMARY KEY,
      content     TEXT NOT NULL,
      salience    REAL NOT NULL DEFAULT 0.5,
      created_at  INTEGER NOT NULL,
      session_id  TEXT NOT NULL DEFAULT '',
      tags        TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS outbox (
      id          TEXT PRIMARY KEY,
      chat_id     TEXT NOT NULL,
      text        TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      sent_at     INTEGER,
      retries     INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_run_source      ON run_records(source);
    CREATE INDEX IF NOT EXISTS idx_run_started     ON run_records(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_memory_salience ON memory(salience DESC);
    CREATE INDEX IF NOT EXISTS idx_outbox_sent     ON outbox(sent_at);
  `);
}

// ── Cron Jobs ─────────────────────────────────────────────────────────────────

export const jobs = {
  list: (): CronJob[] => {
    return getDb()
      .prepare('SELECT * FROM cron_jobs ORDER BY created_at DESC')
      .all()
      .map(rowToJob);
  },

  get: (id: string): CronJob | undefined => {
    const row = getDb().prepare('SELECT * FROM cron_jobs WHERE id = ?').get(id);
    return row ? rowToJob(row) : undefined;
  },

  create: (job: Omit<CronJob, 'id' | 'createdAt' | 'lastRun' | 'nextRun'>): CronJob => {
    const id = crypto.randomUUID();
    const now = Date.now();
    getDb().prepare(`
      INSERT INTO cron_jobs (id, name, schedule, prompt, model, timezone, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, job.name, job.schedule, job.prompt, job.model, job.timezone, job.enabled ? 1 : 0, now);
    return jobs.get(id)!;
  },

  update: (id: string, patch: Partial<CronJob>): void => {
    const fields: string[] = [];
    const vals: unknown[] = [];
    if (patch.name      !== undefined) { fields.push('name = ?');      vals.push(patch.name); }
    if (patch.schedule  !== undefined) { fields.push('schedule = ?');  vals.push(patch.schedule); }
    if (patch.prompt    !== undefined) { fields.push('prompt = ?');    vals.push(patch.prompt); }
    if (patch.model     !== undefined) { fields.push('model = ?');     vals.push(patch.model); }
    if (patch.timezone  !== undefined) { fields.push('timezone = ?');  vals.push(patch.timezone); }
    if (patch.enabled   !== undefined) { fields.push('enabled = ?');   vals.push(patch.enabled ? 1 : 0); }
    if (patch.lastRun   !== undefined) { fields.push('last_run = ?');  vals.push(patch.lastRun); }
    if (patch.nextRun   !== undefined) { fields.push('next_run = ?');  vals.push(patch.nextRun); }
    if (fields.length === 0) return;
    vals.push(id);
    getDb().prepare(`UPDATE cron_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  },

  delete: (id: string): void => {
    getDb().prepare('DELETE FROM cron_jobs WHERE id = ?').run(id);
  },
};

// ── Run Records ───────────────────────────────────────────────────────────────

export const runs = {
  list: (limit = 50): RunRecord[] => {
    return getDb()
      .prepare('SELECT * FROM run_records ORDER BY started_at DESC LIMIT ?')
      .all(limit)
      .map(rowToRun);
  },

  create: (run: Omit<RunRecord, 'id'>): RunRecord => {
    const id = crypto.randomUUID();
    getDb().prepare(`
      INSERT INTO run_records
        (id, job_id, source, prompt, response, model, started_at, finished_at, duration_ms, success, error, tokens_in, tokens_out)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, run.jobId ?? null, run.source, run.prompt, run.response,
      run.model, run.startedAt, run.finishedAt, run.durationMs,
      run.success ? 1 : 0, run.error ?? null, run.tokensIn, run.tokensOut,
    );
    return { id, ...run };
  },

  stats: () => {
    const db = getDb();
    const total      = (db.prepare('SELECT COUNT(*) as c FROM run_records').get() as any).c;
    const successes  = (db.prepare('SELECT COUNT(*) as c FROM run_records WHERE success = 1').get() as any).c;
    const tokensIn   = (db.prepare('SELECT SUM(tokens_in) as s FROM run_records').get() as any).s ?? 0;
    const tokensOut  = (db.prepare('SELECT SUM(tokens_out) as s FROM run_records').get() as any).s ?? 0;
    const lastRun    = (db.prepare('SELECT MAX(started_at) as m FROM run_records').get() as any).m;
    return { total, successRate: total > 0 ? successes / total : 0, tokensIn, tokensOut, lastRun };
  },
};

// ── Memory ────────────────────────────────────────────────────────────────────

export const memory = {
  search: (limit = 10): MemoryEntry[] => {
    return getDb()
      .prepare('SELECT * FROM memory ORDER BY salience DESC, created_at DESC LIMIT ?')
      .all(limit)
      .map(rowToMemory);
  },

  add: (entry: Omit<MemoryEntry, 'id'>): MemoryEntry => {
    const id = crypto.randomUUID();
    getDb().prepare(`
      INSERT INTO memory (id, content, salience, created_at, session_id, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, entry.content, entry.salience, entry.createdAt, entry.sessionId, JSON.stringify(entry.tags));
    return { id, ...entry };
  },

  prune: (keepTop = 200): void => {
    getDb().exec(`
      DELETE FROM memory WHERE id NOT IN (
        SELECT id FROM memory ORDER BY salience DESC, created_at DESC LIMIT ${keepTop}
      )
    `);
  },

  count: (): number => {
    return (getDb().prepare('SELECT COUNT(*) as c FROM memory').get() as any).c;
  },
};

// ── Outbox ────────────────────────────────────────────────────────────────────

export const outbox = {
  push: (chatId: string, text: string): void => {
    const id = crypto.randomUUID();
    getDb().prepare(`
      INSERT INTO outbox (id, chat_id, text, created_at) VALUES (?, ?, ?, ?)
    `).run(id, chatId, text, Date.now());
  },

  pending: (): OutboxMessage[] => {
    return getDb()
      .prepare('SELECT * FROM outbox WHERE sent_at IS NULL ORDER BY created_at ASC LIMIT 20')
      .all()
      .map(rowToOutbox);
  },

  markSent: (id: string): void => {
    getDb().prepare('UPDATE outbox SET sent_at = ? WHERE id = ?').run(Date.now(), id);
  },

  incrementRetry: (id: string): void => {
    getDb().prepare('UPDATE outbox SET retries = retries + 1 WHERE id = ?').run(id);
  },

  pruneOld: (): void => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    getDb().prepare('DELETE FROM outbox WHERE sent_at IS NOT NULL AND created_at < ?').run(cutoff);
  },
};

// ── Row mappers ───────────────────────────────────────────────────────────────

function rowToJob(row: any): CronJob {
  return {
    id: row.id, name: row.name, schedule: row.schedule,
    prompt: row.prompt, model: row.model as ModelId,
    timezone: row.timezone, enabled: !!row.enabled,
    lastRun: row.last_run, nextRun: row.next_run, createdAt: row.created_at,
  };
}

function rowToRun(row: any): RunRecord {
  return {
    id: row.id, jobId: row.job_id, source: row.source,
    prompt: row.prompt, response: row.response, model: row.model as ModelId,
    startedAt: row.started_at, finishedAt: row.finished_at,
    durationMs: row.duration_ms, success: !!row.success,
    error: row.error, tokensIn: row.tokens_in, tokensOut: row.tokens_out,
  };
}

function rowToMemory(row: any): MemoryEntry {
  return {
    id: row.id, content: row.content, salience: row.salience,
    createdAt: row.created_at, sessionId: row.session_id,
    tags: JSON.parse(row.tags ?? '[]'),
  };
}

function rowToOutbox(row: any): OutboxMessage {
  return {
    id: row.id, chatId: row.chat_id, text: row.text,
    createdAt: row.created_at, sentAt: row.sent_at, retries: row.retries,
  };
}
