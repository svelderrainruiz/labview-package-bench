#!/usr/bin/env bash
# Baked build wrapper. VIPM Community Edition only registers the installed
# LabVIEW (and resolves packages) after a `refresh`, and that refresh must run
# inside a public git repository — which the mounted working directory is. So
# register + resolve first, then run the requested vipm command (e.g.
# `build <spec> --labview-version 2026 --labview-bitness 64 ...`).
set -euo pipefail

vipm refresh
exec vipm "$@"
