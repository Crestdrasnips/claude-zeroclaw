// runner.ts — Claude agent SDK wrapper for ZeroClaw Claude
// Uses @anthropic-ai/claude-agent-sdk which spawns the `claude` CLI binary
// as a child process — never reads or transmits OAuth tokens.

import { loadConfig, updateConfig } from '../config.js';
import { memory, runs } from '../db.js';
import type { AgentResult, ModelId } from '../types.js';

// Dynamic import so the SDK is optional during setup
async function getQuery() {
  try {
    const sdk = await import('@anthropic-ai/claude-agent-sdk');
    return sdk.query;
  } catch {
    throw new Error(
      'Claude Agent SDK not found. Ensure claude CLI is installed: npm install -g @anthropic-ai/claude-sdk'
    );
  }
}

const SYSTEM_PREAMBLE = `You are ZeroClaw Claude — a personal assistant daemon running on the user's machine.
You have access to their file system, terminal, and any MCP servers they have configured.
Be concise, helpful, and proactive. When recalling memories, integrate them naturally.
Current time: {TIME}
`;

export async function runAgent(
  prompt: string,
  opts: {
    model?:        ModelId;
    source?:       'cron' | 'telegram' | 'heartbeat' | 'manual';
    jobId?:        string;
    resumeSession?: boolean;
  } = {}
): Promise<AgentResult> {
  const config   = loadConfig();
  const model    = opts.model ?? config.model;
  const source   = opts.source ?? 'manual';
  const startedAt = Date.now();

  // Build context block from top memories
  const memories = memory.search(8);
  const memBlock = memories.length > 0
    ? `\n\n[Relevant memories]\n${memories.map(m => `• ${m.content}`).join('\n')}\n`
    : '';

  const systemPrompt = SYSTEM_PREAMBLE.replace('{TIME}', new Date().toISOString()) + memBlock;
  const fullPrompt   = `${systemPrompt}\n\n${prompt}`;

  // Session resumption
  const sessionId = opts.resumeSession ? (config.sessionId ?? undefined) : undefined;

  let response   = '';
  let tokensIn   = 0;
  let tokensOut  = 0;
  let newSession = '';
  let success    = false;
  let error: string | undefined;

  try {
    const query = await getQuery();

    // Stream response from claude CLI subprocess
    for await (const event of query({
      prompt: fullPrompt,
      model,
      options: {
        permissionMode: 'bypassPermissions',
        ...(sessionId ? { resumeSession: sessionId } : {}),
      },
    })) {
      if (event.type === 'assistant') {
        const text = event.message?.content
          ?.filter((c: any) => c.type === 'text')
          ?.map((c: any) => c.text)
          ?.join('') ?? '';
        response += text;
        tokensOut += event.message?.usage?.output_tokens ?? 0;
        tokensIn  += event.message?.usage?.input_tokens  ?? 0;
      }
      if (event.type === 'system' && event.subtype === 'init') {
        newSession = (event as any).session_id ?? '';
      }
    }

    success = true;

    // Persist session ID for resumption
    if (newSession) {
      updateConfig({ sessionId: newSession });
    }

    // Auto-extract memory from response
    if (response.length > 100) {
      await extractAndStoreMemory(prompt, response, newSession || sessionId || '');
    }

  } catch (err: any) {
    error = err?.message ?? String(err);
    response = `[Error] ${error}`;
  }

  const finishedAt = Date.now();
  const durationMs = finishedAt - startedAt;

  // Persist run record
  runs.create({
    jobId:      opts.jobId ?? null,
    source,
    prompt,
    response,
    model,
    startedAt,
    finishedAt,
    durationMs,
    success,
    error:      error ?? null,
    tokensIn,
    tokensOut,
  });

  return {
    response,
    sessionId:  newSession || sessionId || '',
    tokensIn,
    tokensOut,
    durationMs,
    success,
    error,
  };
}

/** Extract memorable facts from a conversation turn and store them */
async function extractAndStoreMemory(
  prompt: string,
  response: string,
  sessionId: string
): Promise<void> {
  // Simple heuristic: look for factual statements, decisions, or preferences
  const text = `User: ${prompt}\nAssistant: ${response}`;
  const lines = text.split('\n').filter(l => l.trim().length > 20);

  for (const line of lines.slice(0, 3)) {
    const salience = computeSalience(line);
    if (salience > 0.4) {
      memory.add({
        content:   line.trim().slice(0, 300),
        salience,
        createdAt: Date.now(),
        sessionId,
        tags:      [],
      });
    }
  }

  // Prune to keep DB lean
  memory.prune(300);
}

function computeSalience(text: string): number {
  const lower = text.toLowerCase();
  let score = 0.3;

  // Boost for decision/preference signals
  if (/\b(remember|always|never|prefer|decide|important|note)\b/.test(lower)) score += 0.3;
  if (/\b(password|key|token|secret|api)\b/.test(lower)) score += 0.2;
  if (/\b(todo|task|action item|follow up)\b/.test(lower)) score += 0.25;
  if (/\b(deadline|due|by \w+day|tomorrow|next week)\b/.test(lower)) score += 0.2;
  if (text.length > 150) score += 0.1;

  return Math.min(score, 1.0);
}
