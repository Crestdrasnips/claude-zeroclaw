// telegram.ts — Telegram bot integration for ZeroClaw Claude
// Handles text, voice, images, and documents.

import { Bot, Context } from 'grammy';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadConfig, updateConfig } from '../config.js';
import { runAgent } from '../agent/runner.js';
import { outbox, memory } from '../db.js';
import { log } from '../daemon/logger.js';

let bot: Bot | null = null;
let outboxPoller: NodeJS.Timeout | null = null;

export async function startTelegramBot(): Promise<void> {
  const config = loadConfig();

  if (!config.telegram.enabled || !config.telegram.token) {
    log.debug('Telegram bot disabled or not configured');
    return;
  }

  bot = new Bot(config.telegram.token);

  // ── Security: restrict to configured chat ID ────────────────────────────────
  bot.use(async (ctx, next) => {
    const chatId = String(ctx.chat?.id ?? '');
    if (config.telegram.chatId && chatId !== config.telegram.chatId) {
      log.warn(`Blocked unauthorized chat: ${chatId}`);
      return;
    }
    await next();
  });

  // ── Commands ─────────────────────────────────────────────────────────────────

  bot.command('start', async (ctx) => {
    await ctx.reply(
      `🦾 *ZeroClaw Claude is online*\n\n` +
      `I'm your personal AI daemon running on your machine.\n\n` +
      `*Commands:*\n` +
      `/newchat — Start fresh session\n` +
      `/status — Health check\n` +
      `/jobs — List cron jobs\n` +
      `/memory — Show top memories\n` +
      `/help — Full command list\n\n` +
      `Just send me a message to talk to Claude.`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('newchat', async (ctx) => {
    updateConfig({ sessionId: null });
    await ctx.reply('🔄 Session cleared. Starting fresh conversation.');
    log.info('Telegram: /newchat — session cleared');
  });

  bot.command('status', async (ctx) => {
    const cfg = loadConfig();
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);

    await ctx.reply(
      `✅ *ZeroClaw Claude Status*\n\n` +
      `Model: \`${cfg.model}\`\n` +
      `Security: ${cfg.security}\n` +
      `Uptime: ${h}h ${m}m\n` +
      `Memory entries: ${memory.count()}\n` +
      `Session: ${cfg.sessionId ? cfg.sessionId.slice(0, 12) + '...' : 'none'}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('jobs', async (ctx) => {
    const { jobs } = await import('../db.js');
    const allJobs = jobs.list();
    if (allJobs.length === 0) {
      await ctx.reply('No cron jobs configured. Add them via the web dashboard.');
      return;
    }
    const lines = allJobs.map(j =>
      `${j.enabled ? '🟢' : '⚫'} *${j.name}*\n  \`${j.schedule}\` (${j.timezone})\n  _${j.prompt.slice(0, 60)}..._`
    );
    await ctx.reply(lines.join('\n\n'), { parse_mode: 'Markdown' });
  });

  bot.command('memory', async (ctx) => {
    const mems = memory.search(5);
    if (mems.length === 0) {
      await ctx.reply('No memories stored yet.');
      return;
    }
    const lines = mems.map((m, i) => `${i + 1}. ${m.content.slice(0, 120)}`);
    await ctx.reply(`🧠 *Top memories:*\n\n${lines.join('\n\n')}`, { parse_mode: 'Markdown' });
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      `*ZeroClaw Claude — Commands*\n\n` +
      `/start — Welcome message\n` +
      `/newchat — Clear session, start fresh\n` +
      `/status — Daemon health & stats\n` +
      `/jobs — List scheduled cron jobs\n` +
      `/memory — Show top remembered facts\n` +
      `/help — This message\n\n` +
      `Send any text to talk to Claude.\n` +
      `Send a voice note to transcribe + ask Claude.\n` +
      `Send a photo/document for Claude to analyze.`,
      { parse_mode: 'Markdown' }
    );
  });

  // ── Text messages ─────────────────────────────────────────────────────────────

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    const timePrefix = `[${new Date().toLocaleTimeString()}] `;

    log.info(`Telegram message: ${text.slice(0, 80)}`);
    const typing = setInterval(() => ctx.sendChatAction('typing').catch(() => {}), 4000);
    await ctx.sendChatAction('typing');

    try {
      const result = await runAgent(timePrefix + text, {
        source:        'telegram',
        resumeSession: true,
      });

      clearInterval(typing);

      // Split long responses
      const chunks = splitMessage(result.response, 4000);
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: 'HTML' }).catch(async () => {
          await ctx.reply(chunk); // fallback plain text
        });
      }
    } catch (err: any) {
      clearInterval(typing);
      await ctx.reply(`❌ Error: ${err.message}`);
    }
  });

  // ── Voice messages ────────────────────────────────────────────────────────────

  bot.on('message:voice', async (ctx) => {
    const cfg = loadConfig();
    if (!cfg.telegram.allowVoice) {
      await ctx.reply('Voice messages disabled.');
      return;
    }
    if (!cfg.telegram.groqApiKey) {
      await ctx.reply('Voice transcription requires GROQ_API_KEY in config.');
      return;
    }

    await ctx.reply('🎙️ Transcribing...');

    try {
      const file    = await ctx.getFile();
      const fileUrl = `https://api.telegram.org/file/bot${cfg.telegram.token}/${file.file_path}`;
      const tmpPath = path.join(os.tmpdir(), `zc_voice_${Date.now()}.ogg`);

      // Download voice file
      const resp = await fetch(fileUrl);
      const buf  = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(tmpPath, buf);

      // Transcribe with Groq Whisper
      const transcript = await transcribeWithGroq(tmpPath, cfg.telegram.groqApiKey);
      fs.unlinkSync(tmpPath);

      if (!transcript) {
        await ctx.reply('Could not transcribe audio.');
        return;
      }

      await ctx.reply(`🎙️ _"${transcript}"_\n\nAsking Claude...`, { parse_mode: 'Markdown' });

      const result = await runAgent(transcript, {
        source:        'telegram',
        resumeSession: true,
      });

      const chunks = splitMessage(result.response, 4000);
      for (const chunk of chunks) {
        await ctx.reply(chunk).catch(() => {});
      }
    } catch (err: any) {
      await ctx.reply(`❌ Voice error: ${err.message}`);
    }
  });

  // ── Photos ────────────────────────────────────────────────────────────────────

  bot.on('message:photo', async (ctx) => {
    const caption = ctx.message.caption ?? 'What do you see in this image? Describe it in detail.';
    await ctx.sendChatAction('typing');

    const result = await runAgent(caption, {
      source:        'telegram',
      resumeSession: true,
    });

    await ctx.reply(result.response).catch(() => {});
  });

  // ── Start polling ─────────────────────────────────────────────────────────────

  bot.catch((err) => log.error(`Bot error: ${err.message}`));

  bot.start({ onStart: () => log.info('Telegram bot polling started') });

  // ── Outbox poller (every 3s) ──────────────────────────────────────────────────

  outboxPoller = setInterval(async () => {
    const pending = outbox.pending();
    for (const msg of pending) {
      try {
        await bot!.api.sendMessage(msg.chatId, msg.text, { parse_mode: 'HTML' });
        outbox.markSent(msg.id);
      } catch {
        outbox.incrementRetry(msg.id);
      }
    }
    outbox.pruneOld();
  }, 3000);
}

export async function stopTelegramBot(): Promise<void> {
  if (outboxPoller) { clearInterval(outboxPoller); outboxPoller = null; }
  if (bot) { await bot.stop(); bot = null; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function splitMessage(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let split = remaining.lastIndexOf('\n', maxLen);
    if (split < maxLen / 2) split = maxLen;
    chunks.push(remaining.slice(0, split));
    remaining = remaining.slice(split).trimStart();
  }
  return chunks;
}

async function transcribeWithGroq(filePath: string, apiKey: string): Promise<string> {
  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('model', 'whisper-large-v3');

  const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
    body:    form as any,
  });

  const data = await resp.json() as any;
  return data.text ?? '';
}
