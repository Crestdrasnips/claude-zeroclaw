# ZeroClaw Claude

A lightweight, open-source Claude Code daemon. Zero API overhead, zero separate keys — runs entirely within your Claude Code subscription.

## Architecture

```
zeroclaw-claude/
├── src/
│   ├── index.ts            ← Daemon entry point
│   ├── types.ts            ← Shared TypeScript types
│   ├── config.ts           ← Config loader / saver
│   ├── db.ts               ← SQLite layer (better-sqlite3)
│   ├── setup.ts            ← Interactive setup wizard
│   ├── status.ts           ← Health check CLI
│   ├── agent/
│   │   └── runner.ts       ← Claude agent SDK wrapper
│   ├── scheduler/
│   │   └── index.ts        ← node-cron scheduler
│   ├── daemon/
│   │   ├── heartbeat.ts    ← Periodic heartbeat
│   │   └── logger.ts       ← Structured logger
│   ├── bot/
│   │   └── telegram.ts     ← Telegram bot (grammy)
│   └── dashboard/
│       └── server.ts       ← Express + WebSocket dashboard
├── commands/               ← Slash command definitions
├── hooks/                  ← Claude Code hooks
├── skills/                 ← Skill definitions
├── prompts/
│   └── system.md           ← System prompt / persona
└── .claude-plugin/
    └── plugin.json         ← Plugin manifest
```

## Key files

- `~/.zeroclaw-claude/config.json` — runtime config
- `~/.zeroclaw-claude/zeroclaw.db` — SQLite database
- `~/.zeroclaw-claude/zeroclaw.log` — log file
- `~/.zeroclaw-claude/daemon.pid` — running daemon PID

## Commands

```bash
npm run setup    # Interactive setup wizard
npm run status   # Health check
npm run dev      # Dev mode (tsx watch)
npm start        # Production (compiled)
npm run build    # Compile TypeScript
```

## API

Dashboard REST API runs at `http://127.0.0.1:3742`:

- `GET /api/stats` — runtime statistics
- `GET /api/jobs` — list cron jobs
- `POST /api/jobs` — create job
- `PATCH /api/jobs/:id` — update job
- `DELETE /api/jobs/:id` — delete job
- `GET /api/runs` — run history
- `WS /ws` — real-time WebSocket for dashboard

## Security

ZeroClaw never reads or transmits OAuth tokens.
The `@anthropic-ai/claude-agent-sdk` spawns the `claude` CLI binary as a subprocess — it manages its own auth at `~/.claude/`.
