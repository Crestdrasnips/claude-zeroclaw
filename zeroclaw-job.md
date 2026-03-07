# ZeroClaw Claude — Job Management

Create, list, edit, enable, disable, or delete cron jobs.

## Triggers

- `create a job`
- `add a job`
- `new job`
- `schedule a task`
- `schedule a prompt`
- `set up a cron`
- `automate`
- `run on a schedule`
- `recurring task`
- `periodic task`
- `timed task`
- `I want to schedule`
- `I want to create a job`
- `add scheduled task`
- `manage jobs`
- `job list`
- `delete job`
- `remove job`
- `edit job`
- `run job`

## Instructions

When creating a job, collect:
- `name` — human-readable name
- `schedule` — standard cron expression (e.g. `0 9 * * *` for 9am daily)
- `prompt` — the prompt to send Claude when the job fires
- `timezone` — IANA timezone (default: UTC)
- `model` — optional model override

Use the ZeroClaw API at `http://127.0.0.1:3742/api/jobs` to create, list, update, and delete jobs.

Show the user a summary after each operation.
