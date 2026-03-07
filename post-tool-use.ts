#!/usr/bin/env tsx
// post-tool-use.ts — ZeroClaw memory capture hook
// Runs after every Claude tool use and extracts memorable context.

import fs from 'fs';

interface HookInput {
  tool_name:   string;
  tool_input:  unknown;
  tool_output: unknown;
  session_id?: string;
}

async function main(): Promise<void> {
  const raw = fs.readFileSync('/dev/stdin', 'utf-8').trim();
  if (!raw) process.exit(0);

  let input: HookInput;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  // Only capture significant tool outputs
  const significantTools = ['Bash', 'Write', 'Read', 'WebFetch', 'TodoWrite'];
  if (!significantTools.includes(input.tool_name)) {
    process.exit(0);
  }

  // Try to push to ZeroClaw daemon via its DB directly
  // (daemon may not be running, so we just log)
  const summary = `Tool: ${input.tool_name} | ${JSON.stringify(input.tool_input).slice(0, 100)}`;

  // Non-blocking — don't delay Claude
  try {
    const { memory } = await import('../src/db.js');
    memory.add({
      content:   summary,
      salience:  0.35,
      createdAt: Date.now(),
      sessionId: input.session_id ?? '',
      tags:      ['tool-use', input.tool_name],
    });
  } catch {
    // Daemon not running — skip silently
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
