# LabVIEW Package Bench

A VS Code extension for building **VI packages** and **NI packages** from `.vipb` / `.nipb` build
specs, orchestrated across isolated LabVIEW environments. It is deliberately decoupled from
VI-history review tooling so package-building concerns evolve on their own.

> Status: Milestone 1. Right-click VI package builds via the JKI VIPM CLI are **verified end to
> end** on a native Windows host (LabVIEW 2026 64-bit + VIPM) and in the baked NI LabVIEW Linux
> container. The Docker Desktop **Windows** container path is wired and its image builds; in-container
> builds are still being hardened.

## What it does (Milestone 1)

- Adds a **Build Package** command to the editor and Explorer context menus for `.vipb` and `.nipb`
  files (and the Command Palette).
- Builds a **VI package** from a `.vipb` spec by invoking the JKI VIPM CLI.
- Lets you pick the **build environment** per build, or pin one:
  - `native-windows` — runs the VIPM CLI directly on a Windows host. **Verified** on LabVIEW 2026 (64-bit) + VIPM.
  - `docker-linux` — runs the build inside the baked NI LabVIEW **Linux** container (works on Codespaces, Linux CI, and local Docker). Proven end-to-end.
  - `docker-windows` — runs the build inside a derived NI LabVIEW **Windows** container image (VIPM baked in).
- Streams build output to a dedicated **LabVIEW Package Bench** output channel.

NI package builds (`.nipb`) are recognized and reserved for a later milestone.

## Requirements

Choose a build environment:

- **`native-windows` (verified):** a Windows host with LabVIEW (e.g. 2026) and the JKI **VIPM CLI**
  installed. One-time setup:
  - Ensure `vipm` is on `PATH`, or set `labviewPackageBench.vipm.cliPath` to the full path — the
    default install location is `C:\Program Files\JKI\VI Package Manager\support\vipm.exe`.
  - Enable LabVIEW's VI Server so VIPM can drive the build: **Tools » Options » VI Server** → add
    `*` to **Exported VIs** (Allow Access) and `localhost` to **Machine Access** (Allow Access).
  - The `.vipb` must live inside a git repository (VIPM checks the repo before building).
  - Run VS Code **elevated (Run as administrator)** so VIPM runs at the same privilege as LabVIEW
    and can persist that VI Server configuration under `C:\Program Files`. Without matching
    elevation, VIPM fails with a VI Server "Exported VIs / Machine Access" error.
- **`docker-linux` (recommended, proven):** Docker plus the baked NI LabVIEW Linux image
  (`npm run image:build:linux`). Works on Codespaces, Linux CI, and local Docker. VIPM Community
  Edition requires the `.vipb` to live inside a **public git repository**.
- **`docker-windows`:** Docker Desktop in Windows-containers mode plus the derived LabVIEW + VIPM
  Windows image (`npm run image:build:windows`). Requires a VIPM Pro serial for in-container
  activation.

The extension's command construction is unit-tested on Linux; execution needs the chosen runtime.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `labviewPackageBench.defaultProvider` | `ask` | `ask`, `docker-linux`, `native-windows`, or `docker-windows`. |
| `labviewPackageBench.labview.version` | `2026` | LabVIEW version year (`--labview-version`). |
| `labviewPackageBench.labview.bitness` | `64` | LabVIEW bitness (`--labview-bitness`). |
| `labviewPackageBench.vipm.cliPath` | `vipm` | Path to the VIPM CLI executable (native providers). On Windows, `vipm` resolves on `PATH`; otherwise set the full path (default install: `C:\Program Files\JKI\VI Package Manager\support\vipm.exe`). |
| `labviewPackageBench.vipm.buildArgs` | `["build", "${specPath}", "--labview-version", "${labviewVersion}", "--labview-bitness", "${labviewBitness}", "--show-progress", "--verbose"]` | VIPM CLI argument template; `${specPath}`, `${labviewVersion}`, `${labviewBitness}` are substituted. |
| `labviewPackageBench.linuxContainer.image` | `labview-package-bench-linux:latest` | NI LabVIEW Linux image (VIPM baked in) used by `docker-linux`. |
| `labviewPackageBench.linuxContainer.cacheVolume` | `labview-package-bench-vipm-cache` | Docker volume for the VIPM package cache (faster repeat `refresh`); empty to disable. |
| `labviewPackageBench.docker.image` | `labview-package-bench-windows:latest` | Windows container image used by `docker-windows`. |
| `labviewPackageBench.docker.containerWorkdir` | `C:\work` | In-container mount/working directory (Windows). |
| `labviewPackageBench.docker.dns` | `` | Optional DNS server for the `docker-windows` container (e.g. `8.8.8.8`). Set it when the Docker NAT DNS cannot resolve, which otherwise breaks VIPM Pro online activation in the container. |

> The default `vipm.buildArgs` match the JKI VIPM CLI 2026.3 (`vipm build <spec> --labview-version
> <year> --labview-bitness <32\|64> --show-progress --verbose`). Adjust them if your installed VIPM
> CLI differs.

## Build a VI package with the Linux container

```bash
npm run image:build:linux   # bake the NI LabVIEW + VIPM image (one time)
```

Then right-click a `.vipb` inside a **public git repo** and choose **Build Package → Docker Linux
container**. The baked image (see [`docker/`](docker/Dockerfile)) installs VIPM, brings up a
headless display and LabVIEW, runs `vipm refresh` to register LabVIEW, and builds the `.vip` at the
repository root. This path is verified end-to-end (it builds the reference
[VIT-Super-Network-Streams](https://github.com/svelderrainruiz/VIT-Super-Network-Streams) `.vipb`).

## Build a VI package on a native Windows host

With LabVIEW + VIPM installed and the one-time setup from **Requirements** above, set
`labviewPackageBench.defaultProvider` to `native-windows`, then right-click a **named** `.vipb`
(e.g. `Foo.vipb`, not a bare `.vipb`) inside a git repo and choose **Build Package**. The provider
runs the VIPM CLI directly, with the spec's directory as the working directory:

```powershell
vipm build <Foo>.vipb --labview-version 2026 --labview-bitness 64 --show-progress --verbose
```

Verified end-to-end on LabVIEW 2026 (64-bit) + VIPM 2026.3, producing a `.vip` at the location the
spec defines. No `vipm refresh` is needed on a host whose LabVIEW is already registered.

## Build a VI package with the Windows container

```powershell
npm run image:build:windows   # derive the LabVIEW + VIPM Windows image (one time)
```

This downloads the VIPM installer and builds `labview-package-bench-windows:latest` from NI's
official LabVIEW **Windows** image (see [`docker/windows/`](docker/windows/Dockerfile)). VIPM Pro
activation is required inside the container: copy [`docker/windows/.env.example`](docker/windows/.env.example)
to `docker/windows/.env` and fill in your serial, or set `VIPM_SERIAL_NUMBER` / `VIPM_FULL_NAME` /
`VIPM_EMAIL` in the environment VS Code runs in — the provider forwards them **by name only**, so the
serial never appears on a command line. If the Docker NAT DNS cannot resolve (which breaks
activation), set `labviewPackageBench.docker.dns` (e.g. `8.8.8.8`). The container's baked wrapper
activates VIPM Pro, runs `vipm refresh`, warms LabVIEW headless (`LabVIEW.exe --headless`, waiting
for its VI Server port), then runs the build.

> **Status:** the image build, VIPM Pro activation, `vipm refresh`, and the headless LabVIEW
> launch + VI Server connection are verified, and VIPM starts the build inside the container.
> Completing the in-container **packaging** step is still being hardened — upstream VIPM
> Windows-container builds are maturing, and a spec whose LabVIEW version differs from the
> container's forces a headless recompile that can stall. Use **`native-windows`** for a verified
> `.vip` today.

## Development

```bash
npm ci
npm run check   # type-check
npm test        # unit tests + coverage
npm run compile # emit ./out
```

The unit suite is deterministic and separator-agnostic (it never spawns a real build). To verify a
provider end-to-end against real LabVIEW + VIPM, run the opt-in integration harness:

```powershell
$env:LVPB_INTEGRATION = '1'
$env:LVPB_SPEC = 'C:\path\to\Foo.vipb'   # a named .vipb in a git repo
$env:LVPB_PROVIDER = 'native-windows'    # or docker-windows
npm run test:integration
```

It builds through the real provider invocation + process runner and asserts a `.vip` is produced.

Governance tooling (agent fleet, audits):

```bash
npm run fleet:generate     # regenerate agent dialects from .github/agent-fleet/
npm run fleet:check        # fail on drift
npm run customization:audit
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md).
