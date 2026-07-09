# Contributing

Thanks for helping build LabVIEW Package Bench.

## Development setup

```bash
npm ci
npm run check
npm test
```

## Branch and PR Flow

- Branch off the default branch for every change: use `feature/<slug>` for features and
  `fix/<slug>` for fixes.
- Do not push directly to the default branch; open a pull request.
- Keep implementation and unit tests in the same change when behavior changes.
- Before handoff, run `npm run check`, `npm test`, `npm run fleet:check`, and
  `npm run customization:audit`.

## Testing expectations

- Keep unit tests deterministic and separator-agnostic so they pass on Linux CI and Windows dev
  hosts.
- Exercise build-command construction through the exported pure helpers and the injected process
  runner rather than spawning real processes.

## Agent governance

Custom agents are single-sourced under `.github/agent-fleet/` and generated into both the Copilot
(`.github/agents/`) and Claude Code (`.claude/agents/`) dialects. Edit the canonical source and run
`npm run fleet:generate`; never hand-edit the generated files. See [AGENTS.md](AGENTS.md).
