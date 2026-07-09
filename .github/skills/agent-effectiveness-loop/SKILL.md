---
name: agent-effectiveness-loop
description: "Use after completing a task to capture friction and improve agent guidance in labview-package-bench."
argument-hint: "Optional task summary"
---

# Agent Effectiveness Loop

At the end of substantial tasks, improve the agent guidance in the same change when you discover friction.

1. Capture one blocker or delay encountered.
2. Apply the smallest durable update to `AGENTS.md` or a relevant skill.
3. Regenerate the agent fleet if governance sources changed: `npm run fleet:generate`.
4. Verify referenced commands and paths still work.
