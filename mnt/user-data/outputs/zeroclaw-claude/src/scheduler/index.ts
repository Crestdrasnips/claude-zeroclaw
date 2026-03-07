// scheduler/index.ts — Timezone-aware cron scheduler for ZeroClaw Claude

import cron, { ScheduledTask } from 'node-cron';
import { jobs } from '../db.js';
import { runAgent } from '../agent/runner.js';
import { log } from '../daemon/logger.js';
import type { CronJob } from '../types.js';

const activeTasks = new Map<string, ScheduledTask>();

export function startScheduler(): void {
  log.info('Scheduler starting...');

  // Load all enabled jobs from DB
  const allJobs = jobs.list().filter(j => j.enabled);
  for (const job of allJobs) {
    scheduleJob(job);
  }

  log.info(`Scheduler started — ${allJobs.length} active jobs`);
}

export function stopScheduler(): void {
  for (const [id, task] of activeTasks) {
    task.stop();
    activeTasks.delete(id);
  }
  log.info('Scheduler stopped');
}

export function scheduleJob(job: CronJob): void {
  // Remove existing task if present
  if (activeTasks.has(job.id)) {
    activeTasks.get(job.id)!.stop();
    activeTasks.delete(job.id);
  }

  if (!job.enabled) return;

  if (!cron.validate(job.schedule)) {
    log.warn(`Invalid cron expression for job "${job.name}": ${job.schedule}`);
    return;
  }

  const task = cron.schedule(
    job.schedule,
    async () => {
      log.info(`Running cron job: ${job.name}`);
      jobs.update(job.id, { lastRun: Date.now() });

      try {
        const result = await runAgent(job.prompt, {
          model:  job.model,
          source: 'cron',
          jobId:  job.id,
        });

        log.info(`Cron job "${job.name}" done — ${result.durationMs}ms`);
      } catch (err: any) {
        log.error(`Cron job "${job.name}" failed: ${err.message}`);
      }
    },
    { timezone: job.timezone }
  );

  activeTasks.set(job.id, task);
  log.debug(`Scheduled job "${job.name}" — ${job.schedule} [${job.timezone}]`);
}

export function unscheduleJob(id: string): void {
  if (activeTasks.has(id)) {
    activeTasks.get(id)!.stop();
    activeTasks.delete(id);
  }
}

export function refreshJob(id: string): void {
  const job = jobs.get(id);
  if (job) {
    scheduleJob(job);
  } else {
    unscheduleJob(id);
  }
}

export function getActiveJobCount(): number {
  return activeTasks.size;
}
