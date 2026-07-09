---
name: testing-automation
description: "Use when running or debugging tests and validation gates in labview-package-bench."
argument-hint: "Optional scope or failing suite"
---

# Testing Automation

- Type-check: `npm run check`
- Unit tests with coverage: `npm test`
- Regenerate the agent fleet after governance edits: `npm run fleet:generate`, then guard drift with `npm run fleet:check`.
- Customization governance audit: `npm run customization:audit`.

Keep unit tests deterministic and separator-agnostic so they pass on Linux CI and Windows dev hosts.
Exercise build-command construction through the exported pure helpers and injected process runner
rather than spawning real processes.
