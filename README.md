# LabVIEW Package Bench

A VS Code extension for building **VI packages** and **NI packages** from `.vipb` / `.nipb` build
specs, orchestrated across isolated LabVIEW environments. It is deliberately decoupled from
VI-history review tooling so package-building concerns evolve on their own.

> Status: early scaffold. Milestone 1 targets right-click VI package builds via the JKI VIPM CLI on
> a native Windows host or a Docker Desktop Windows container.

## What it does (Milestone 1)

- Adds a **Build Package** command to the editor and Explorer context menus for `.vipb` and `.nipb`
  files (and the Command Palette).
- Builds a **VI package** from a `.vipb` spec by invoking the JKI VIPM CLI.
- Lets you pick the **build environment** per build, or pin one:
  - `native-windows` — runs the VIPM CLI directly on the Windows host.
  - `docker-windows` — runs the build inside a Docker Desktop Windows container image.
- Streams build output to a dedicated **LabVIEW Package Bench** output channel.

NI package builds (`.nipb`) are recognized and reserved for a later milestone.

## Requirements

Building a real package is Windows-only and requires either:

- a Windows host with LabVIEW and the JKI **VIPM CLI** installed, or
- Docker Desktop in **Windows containers** mode with an image that has LabVIEW + VIPM installed.

The extension's command construction is unit-tested on Linux; only execution needs Windows.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `labviewPackageBench.defaultProvider` | `ask` | `ask`, `native-windows`, or `docker-windows`. |
| `labviewPackageBench.vipm.cliPath` | `vipm` | Path to the VIPM CLI executable. |
| `labviewPackageBench.vipm.buildArgs` | `["build", "${specPath}"]` | VIPM CLI argument template; `${specPath}` is the `.vipb` path. |
| `labviewPackageBench.docker.image` | `labview-package-bench-windows:latest` | Windows container image used by `docker-windows`. |
| `labviewPackageBench.docker.containerWorkdir` | `C:\work` | In-container mount/working directory. |

> The exact VIPM CLI verb/flags are deployment-specific — adjust `vipm.buildArgs` to match your
> installed VIPM CLI.

## Development

```bash
npm ci
npm run check   # type-check
npm test        # unit tests + coverage
npm run compile # emit ./out
```

Governance tooling (agent fleet, audits):

```bash
npm run fleet:generate     # regenerate agent dialects from .github/agent-fleet/
npm run fleet:check        # fail on drift
npm run customization:audit
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md).
