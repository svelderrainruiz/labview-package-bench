#!/usr/bin/env bash
# Headless bring-up for LabVIEW + VIPM inside the container, then run the passed
# command (e.g. `vipm build <spec> --labview-version 2026 --labview-bitness 64`).
# Mirrors the JKI VIPM Linux-container display recipe.
set -euo pipefail

export DISPLAY="${DISPLAY:-:99}"

# Start a virtual framebuffer so the LabVIEW Runtime Engine (required by VIPM)
# has a display. If one is already running, assume it is configured correctly.
if ! pgrep -x Xvfb >/dev/null 2>&1; then
  Xvfb "${DISPLAY}" -screen 0 1280x720x24 -ac +extension GLX +render -noreset \
    >/tmp/xvfb.log 2>&1 &
fi

# This marker file is required for the LabVIEW Runtime Engine to start in a
# container; without it VIPM's LabVIEW connection may never come up.
mkdir -p /tmp/natinst && echo "1" >/tmp/natinst/LVContainer.txt

# Start LabVIEW headless in the background so VIPM can connect to it.
lv_bin="/usr/local/natinst/LabVIEW-${LABVIEW_VERSION_YEAR:-2026}-64/labview"
if [ -x "${lv_bin}" ]; then
  "${lv_bin}" --headless >/tmp/labview.log 2>&1 &
fi

exec "$@"
