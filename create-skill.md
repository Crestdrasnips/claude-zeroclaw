# ZeroClaw Skill: Create Skill

Create new skills (slash commands) for Claude Code / ZeroClaw.

## Triggers

- `create a skill`
- `add a skill`
- `make a new command`
- `build a skill`
- `add a slash command`
- `create a plugin skill`
- `define a new automation`
- `new skill`

## Instructions

When a user asks to create a new skill:

1. Ask for:
   - **Name** — short kebab-case name (e.g. `daily-standup`)
   - **Purpose** — what should Claude do when this runs?
   - **Triggers** — what phrases should activate it?

2. Create a new file at `skills/{name}.md` with:
   ```markdown
   # {Name}
   
   {Purpose}
   
   ## Triggers
   {list of trigger phrases}
   
   ## Instructions
   {step-by-step instructions for Claude}
   ```

3. Confirm the skill was created and explain how to activate it.

## Example

User: "Create a skill that runs a daily git status check every morning"

→ Creates `skills/git-daily.md` with a cron-aware skill that checks git status and sends a summary.
