# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
- Initial extension scaffold: **Build Package** command on `.vipb` / `.nipb` context menus.
- VI package builds via the JKI VIPM CLI with `docker-linux`, `native-windows`, and `docker-windows` providers.
- **NI package builds** from a `.pbs` NI Package Builder solution via the NI Package Builder CLI (`NipbCli`), on the `native-windows` provider (NI Package Builder is Windows-only and absent from the container images). Adds `labviewPackageBench.nipb.cliPath` / `nipb.buildArgs` settings, `.pbs` menu + detection (with `.nipb` kept as a legacy alias), and provider capability gating so only environments that can build a given package type are offered.
- Marketplace packaging: a 128×128 extension icon, `keywords` + a gallery banner, a `.vscodeignore`, and an `npm run package` script (`vsce package`) that produces a lean `.vsix` (compiled `out/` + icon + docs only, ~25 KB).
- `docker-linux` provider plus a baked NI LabVIEW Linux image (`docker/Dockerfile`, `npm run image:build:linux`) that installs VIPM, brings up a headless display + LabVIEW, and runs `vipm refresh`/`vipm build`. Verified end-to-end in Codespaces.
- LabVIEW version/bitness settings and the real `vipm build --labview-version/--labview-bitness` argument template.
- Provider picker and a dedicated build output channel.
- Builds now run under a **cancellable progress notification** — cancelling kills the underlying build process, and for container builds it `docker kill`s the run's container (not just the docker client, which does not stop the daemon-owned container). The build outcome reports `cancelled` distinctly from a failure.
- Dual-runtime agent fleet (Copilot + Claude Code) with governance audits and a branch-guard hook.
- `docker-windows` image assets (`docker/windows/Dockerfile`, `docker/windows/vipm-build.ps1`, `scripts/fetchVipmInstaller.js`, `npm run image:build:windows`) that derive a VIPM-enabled LabVIEW **Windows** container. The baked wrapper activates VIPM Pro, runs `vipm refresh`, warms LabVIEW headless, then runs the build, and forwards `VIPM_SERIAL_NUMBER`/`VIPM_FULL_NAME`/`VIPM_EMAIL` by name only. Activation, refresh, the headless LabVIEW launch, and the build start are verified in-container; the `vipm build` step itself does not yet complete headlessly (an upstream VIPM Windows-container limitation, reproduced even with a version-matched source).
- `labviewPackageBench.docker.dns` setting to supply an explicit DNS server for the Windows container (works around a Docker NAT DNS failure that otherwise breaks VIPM Pro online activation).
- Opt-in integration test harness (`npm run test:integration`) that builds a real `.vip` (from a `.vipb`) or `.nipkg` (from a `.pbs` via `NipbCli`) through the selected provider and asserts the artifact lands on disk, with a provider-capability guard. The extension's `NipbCli` invocation is validated against the real CLI (it accepts `-o=<spec> -b=packages --save`).
- CI also runs `npm run check` and `npm test` on `windows-latest` (the platform the native/container providers target), alongside the full gate suite on Linux.
- Manual `Verify docker-windows` GitHub Actions workflow (`workflow_dispatch`) that builds the image on `windows-latest` and activates VIPM Pro + refreshes inside the container using `VIPM_SERIAL_NUMBER` / `VIPM_FULL_NAME` / `VIPM_EMAIL` repository secrets (replacing the local `.env` for CI; forwarded by name only).
- Developer `.vscode/launch.json` (**Run Extension**) + `tasks.json` and an `npm run watch` script to dogfood the extension in the Extension Development Host (F5).

### Changed
- **`native-windows` provider verified end-to-end** on a Windows host with LabVIEW 2026 (64-bit and 32-bit) + VIPM. The README documents the required setup: `vipm` on `PATH` (or `vipm.cliPath` to the full path), LabVIEW VI Server *Exported VIs* / *Machine Access*, and running VS Code elevated so VIPM matches an elevated LabVIEW.
- The container providers now log a build advisory: in-container package **building** is an upstream VIPM preview and may not complete headlessly, so `native-windows` stays the verified build path. The containers remain proven for dependency install/refresh (`docker-linux`).
- Build errors are clearer: a missing CLI or Docker (spawn `ENOENT`) explains how to fix it (install it, set `vipm.cliPath` / `nipb.cliPath`, or start Docker Desktop), and a VIPM Community git-repository failure points to opening the repository root or activating VIPM Professional.

### Fixed
- Native VIPM (VI) builds no longer abort spuriously on VIPM's short liveliness watchdog. A long, silent mass-compile could trip VIPM's 60 s default even though the `.vip` was still being produced; the extension now runs native `vipm build` with `VIPM_DESKTOP_LIVELINESS_TIMEOUT=600` (the same tolerance the container images bake in). Verified end-to-end against a real spec: the build that previously aborted at 60 s now completes and writes the `.vip`.
- A rebuild whose package already exists now fails with a clear, actionable message instead of a cryptic `Code:: 10`. VIPM refuses to overwrite an existing `.vip` (and its CLI has no force/overwrite flag); the extension now recognizes the *"already exists in build output location"* failure, names the conflicting `.vip`, and advises deleting it or raising the version in the build spec.
- NI build settings are now honored: `labviewPackageBench.nipb.cliPath` and `nipb.buildArgs` are read from the workspace configuration (the extension previously ignored them and always used the defaults).
- The **Build Package** menu and package detection now recognize a **bare dotfile spec** (a file named `.vipb` / `.nipb`, as some repositories name their build spec), not only the `Name.vipb` form.

