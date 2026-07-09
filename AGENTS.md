# labview-package-bench Agent Instructions

Concise guidance for AI coding agents working in this repository.

## Project

VS Code extension that builds VI/NI packages from `.vipb` / `.nipb` build specs across isolated
LabVIEW environments (native Windows and Docker Desktop Windows containers to start). Intentionally
decoupled from VI-history review tooling.

## Build & Test Commands

- **Type-check:** `npm run check`
- **Test (coverage):** `npm test`
- **Compile:** `npm run compile`
- **Regenerate agents:** `npm run fleet:generate`
- **Guard agent drift:** `npm run fleet:check`
- **Customization audit:** `npm run customization:audit`

Run `npm ci` first in a fresh clone before invoking `node_modules/.bin/vitest`.

## Architecture

- `src/extension.ts` — activation and command wiring (the only file that imports `vscode`
  at runtime besides the UI adapters).
- `src/commands/buildPackageCommand.ts` — build orchestration and pure helpers; no `vscode` import
  so it stays unit-testable.
- `src/packaging/` — package-type detection, VIPM CLI invocation, settings, provider interface,
  process runner.
- `src/providers/` — native-windows and docker-windows build providers plus their registry.
- `src/ui/` — output-channel log adapter and provider picker.
- `tests/unit/` — deterministic Vitest suites over the pure helpers and injected boundaries.

## Conventions

- TypeScript, Node16 modules, strict mode; `rootDir` `src`, `outDir` `out`.
- Keep process/`vscode` boundaries injected so logic is testable off-Windows.
- Keep path handling separator-agnostic; never assume a single OS shell.
- Command id namespace `labviewPackageBench.*`; settings namespace `labviewPackageBench.*`.

## Agent Skills (Workspace)

- `.github/skills/onboarding/SKILL.md`: first-run and environment setup
- `.github/skills/testing-automation/SKILL.md`: testing and validation-gate workflow
- `.github/skills/agent-effectiveness-loop/SKILL.md`: iterative guidance upgrades after a task

## Custom Agents (Workspace)

- `.github/agents/workflow-governor.agent.md`: task execution with branch policy, testing, and PR evidence discipline
- `.github/agents/code-reviewer.agent.md`: read-only quality, security, and maintainability review specialist

## Dual-Runtime Agent Fleet

Custom agents are single-sourced: author each agent once under `.github/agent-fleet/<name>.md`
(canonical frontmatter plus a shared system-prompt body using `@root/`-relative links), then
generate both runtime dialects.

- Generate: `npm run fleet:generate` emits the Copilot agent files under `.github/agents/` and the
  Claude Code agent files under `.claude/agents/` via `scripts/generateAgentFleet.js`.
- Guard drift: `npm run fleet:check` fails when the generated files no longer match the canonical
  sources; run it before PR handoff after editing any fleet source.
- Do not hand-edit the generated agent files under `.github/agents/` or `.claude/agents/` — edit the
  canonical source in `.github/agent-fleet/` and regenerate.
- Enforcement: `.claude/settings.json` wires a `PreToolUse` git guard
  (`scripts/agent-hooks/guardGitBranch.js`) that blocks direct pushes to the default branch, force
  pushes, `--no-verify`, and `git reset --hard` in Claude Code.

## Iterative Improvement Rule

At the end of substantial tasks, improve the agent guidance in the same change when you discover
friction. Prefer the smallest durable update to `AGENTS.md` or a relevant skill, then verify
referenced commands and paths still work.

## Key Documentation

- [README](README.md)
- [Contributing](CONTRIBUTING.md)
