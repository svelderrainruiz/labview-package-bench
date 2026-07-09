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
  - `docker-linux` — runs the build inside the baked NI LabVIEW **Linux** container (works on Codespaces, Linux CI, and local Docker). Proven end-to-end.
  - `native-windows` — runs the VIPM CLI directly on a Windows host.
  - `docker-windows` — runs the build inside a Docker Desktop Windows container image.
- Streams build output to a dedicated **LabVIEW Package Bench** output channel.

NI package builds (`.nipb`) are recognized and reserved for a later milestone.

## Requirements

Choose a build environment:

- **`docker-linux` (recommended, proven):** Docker plus the baked NI LabVIEW Linux image
  (`npm run image:build:linux`). Works on Codespaces, Linux CI, and local Docker. VIPM Community
  Edition requires the `.vipb` to live inside a **public git repository**.
- **`native-windows`:** a Windows host with LabVIEW and the JKI **VIPM CLI** installed.
- **`docker-windows`:** Docker Desktop in Windows-containers mode with a LabVIEW + VIPM image.

The extension's command construction is unit-tested on Linux; execution needs the chosen runtime.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `labviewPackageBench.defaultProvider` | `ask` | `ask`, `docker-linux`, `native-windows`, or `docker-windows`. |
| `labviewPackageBench.labview.version` | `2026` | LabVIEW version year (`--labview-version`). |
| `labviewPackageBench.labview.bitness` | `64` | LabVIEW bitness (`--labview-bitness`). |
| `labviewPackageBench.vipm.cliPath` | `vipm` | Path to the VIPM CLI executable (native providers). |
| `labviewPackageBench.vipm.buildArgs` | `["build", "${specPath}", "--labview-version", "${labviewVersion}", "--labview-bitness", "${labviewBitness}", "--show-progress", "--verbose"]` | VIPM CLI argument template; `${specPath}`, `${labviewVersion}`, `${labviewBitness}` are substituted. |
| `labviewPackageBench.linuxContainer.image` | `labview-package-bench-linux:latest` | NI LabVIEW Linux image (VIPM baked in) used by `docker-linux`. |
| `labviewPackageBench.docker.image` | `labview-package-bench-windows:latest` | Windows container image used by `docker-windows`. |
| `labviewPackageBench.docker.containerWorkdir` | `C:\work` | In-container mount/working directory (Windows). |

> The exact VIPM CLI verb/flags are deployment-specific — adjust `vipm.buildArgs` to match your
> installed VIPM CLI.

## Build a VI package with the Linux container

```bash
npm run image:build:linux   # bake the NI LabVIEW + VIPM image (one time)
```

Then right-click a `.vipb` inside a **public git repo** and choose **Build Package → Docker Linux
container**. The baked image (see [`docker/`](docker/Dockerfile)) installs VIPM, brings up a
headless display and LabVIEW, runs `vipm refresh` to register LabVIEW, and builds the `.vip` at the
repository root. This path is verified end-to-end (it builds the reference
[VIT-Super-Network-Streams](https://github.com/svelderrainruiz/VIT-Super-Network-Streams) `.vipb`).

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
