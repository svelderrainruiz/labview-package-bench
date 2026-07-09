# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
- Initial extension scaffold: **Build Package** command on `.vipb` / `.nipb` context menus.
- VI package builds via the JKI VIPM CLI with `docker-linux`, `native-windows`, and `docker-windows` providers.
- `docker-linux` provider plus a baked NI LabVIEW Linux image (`docker/Dockerfile`, `npm run image:build:linux`) that installs VIPM, brings up a headless display + LabVIEW, and runs `vipm refresh`/`vipm build`. Verified end-to-end in Codespaces.
- LabVIEW version/bitness settings and the real `vipm build --labview-version/--labview-bitness` argument template.
- Provider picker and a dedicated build output channel.
- Dual-runtime agent fleet (Copilot + Claude Code) with governance audits and a branch-guard hook.
- `docker-windows` image assets (`docker/windows/Dockerfile`, `docker/windows/vipm-build.ps1`, `scripts/fetchVipmInstaller.js`, `npm run image:build:windows`) that derive a VIPM-enabled LabVIEW **Windows** container. The baked wrapper activates VIPM Pro, runs `vipm refresh`, warms LabVIEW headless, then runs the build, and forwards `VIPM_SERIAL_NUMBER`/`VIPM_FULL_NAME`/`VIPM_EMAIL` by name only. Activation, refresh, the headless LabVIEW launch, and the build start are verified in-container; the `vipm build` step itself does not yet complete headlessly (an upstream VIPM Windows-container limitation, reproduced even with a version-matched source).
- `labviewPackageBench.docker.dns` setting to supply an explicit DNS server for the Windows container (works around a Docker NAT DNS failure that otherwise breaks VIPM Pro online activation).
- Opt-in integration test harness (`npm run test:integration`) that builds a real `.vip` through the selected provider and asserts the artifact lands on disk.

### Changed
- **`native-windows` provider verified end-to-end** on a Windows host with LabVIEW 2026 (64-bit and 32-bit) + VIPM. The README documents the required setup: `vipm` on `PATH` (or `vipm.cliPath` to the full path), LabVIEW VI Server *Exported VIs* / *Machine Access*, and running VS Code elevated so VIPM matches an elevated LabVIEW.

