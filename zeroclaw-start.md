# ZeroClaw Claude — Start

Start the ZeroClaw daemon (scheduler, heartbeat, Telegram bot, web dashboard).

## Triggers

- `/zeroclaw:start`
- `start zeroclaw`
- `launch zeroclaw daemon`
- `run zeroclaw`

## Instructions

When the user runs this command:

1. Check if `npm` and `node` ≥ 20 are available
2. Check if dependencies are installed (`node_modules` exists), if not run `npm install`
3. If config doesn't exist, run `npm run setup` first
4. Start the daemon: `npm start`
5. Tell the user the dashboard URL and any configured integrations

## Example output

```
⚡ ZeroClaw Claude daemon starting...

✅ Scheduler active
✅ Heartbeat every 60min
✅ Telegram bot connected
✅ Dashboard: http://127.0.0.1:3742

ZeroClaw Claude is running. Use /zeroclaw:status to check health.
```
