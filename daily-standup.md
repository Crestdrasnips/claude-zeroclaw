# ZeroClaw Skill: Daily Standup

Automatically generate and send a daily standup summary based on git activity, open TODOs, and recent tasks.

## Triggers

- `daily standup`
- `morning report`
- `what did I work on yesterday`
- `standup summary`
- `generate standup`

## Instructions

1. Check git log for the last 24h: `git log --since="24 hours ago" --oneline`
2. Look for any TODO files or task lists in the current directory
3. Check recent run history from the ZeroClaw dashboard (GET http://127.0.0.1:3742/api/runs)
4. Generate a concise standup in this format:

```
📋 Daily Standup — {date}

Yesterday:
• {git commit summaries}
• {completed tasks}

Today:
• {open TODOs}
• {upcoming scheduled jobs}

Blockers:
• {anything that needs attention}
```

5. If Telegram is configured, send it via the outbox.
