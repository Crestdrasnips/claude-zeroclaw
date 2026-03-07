# ZeroClaw Claude — Status

Show daemon health, active jobs, recent runs, and integration status.

## Triggers

- `/zeroclaw:status`
- `zeroclaw status`
- `is zeroclaw running`
- `check zeroclaw`

## Instructions

Run `npm run status` from the zeroclaw-claude directory, or fetch `http://127.0.0.1:3742/api/stats`.

Display a formatted summary with:
- Daemon running / stopped
- Claude CLI version
- Active cron jobs count
- Total runs and success rate
- Memory entries count
- Dashboard URL
- Telegram bot status
