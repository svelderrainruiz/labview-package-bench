---
name: onboarding
description: "Use when setting up labview-package-bench for local development and first-run validation."
argument-hint: "Optional environment notes"
---

# Onboarding

1. Install dependencies: `npm ci`
2. Type-check: `npm run check`
3. Run unit tests with coverage: `npm test`
4. Verify agent governance: `npm run fleet:check` and `npm run customization:audit`

Building a real VI package requires a Windows host with LabVIEW and the JKI VIPM CLI, or a Docker
Desktop Windows container image with the same toolchain. The extension's build-command construction
is unit-tested on Linux, but package execution is Windows-only.

See [README](../../../README.md) and [CONTRIBUTING](../../../CONTRIBUTING.md).
