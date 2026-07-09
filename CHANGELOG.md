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
