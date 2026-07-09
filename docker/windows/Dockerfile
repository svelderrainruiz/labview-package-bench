# Derives a VIPM-enabled LabVIEW image from NI's official LabVIEW **Windows**
# container so that `docker run <image> build <spec> --labview-version ...` can
# build VI packages headlessly. Mirrors the JKI VIPM Windows-container recipe:
# https://github.com/vipm-io/examples-vipm-docker (LabVIEW 2026 Windows example).
#
# Build (from this directory):
#   docker build -t labview-package-bench-windows:latest docker/windows
# Override the base image or VIPM installer with --build-arg as needed.
ARG LABVIEW_IMAGE=nationalinstruments/labview:2026q1patch2-windows
FROM ${LABVIEW_IMAGE}

# Non-interactive VIPM + uncolored output so unattended/CI builds never hang on a
# prompt and produce clean logs.
ENV VIPM_NONINTERACTIVE=1 \
    NO_COLOR=1

# Pre-fetched JKI VIPM Windows installer (run `npm run image:build:windows`, which
# downloads it via scripts/fetchVipmInstaller.js first). It is COPYed from the
# build context rather than downloaded inside the container because Windows build
# containers on this and many hosts cannot resolve DNS.
COPY vipm-setup.exe C:/vipm-setup.exe

# Run the install steps through PowerShell with fail-fast semantics.
SHELL ["powershell", "-Command", "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue';"]

# Silent-install VIPM on top of the NI LabVIEW image, then drop the installer.
RUN Start-Process -Wait -FilePath 'C:\vipm-setup.exe' -ArgumentList '/quiet', '/norestart'; \
    Remove-Item 'C:\vipm-setup.exe' -Force

# The Windows installer lands the VIPM CLI here; put it on the machine PATH so
# subsequent layers and `docker run` invocations resolve `vipm`.
RUN $vipmPath = 'C:\Program Files\JKI\VIPM'; \
    [Environment]::SetEnvironmentVariable('PATH', $env:PATH + ';' + $vipmPath, 'Machine')

# Fail the image build early if VIPM did not install/resolve.
RUN vipm --version

# Tolerate the long, silent stretches of a first cold LabVIEW build in a container
# before VIPM's watchdog would otherwise abort (mirrors the Linux image). Kept
# below the install layers so wrapper/ENV edits don't rebuild the VIPM install.
ENV VIPM_DESKTOP_LIVELINESS_TIMEOUT=600

# Baked build wrapper: activate VIPM Pro (if a serial is provided), refresh
# package sources to register LabVIEW, then run the passed vipm command. Copied
# last so wrapper edits rebuild quickly (the VIPM-install layer stays cached).
COPY vipm-build.ps1 C:/lvpb/vipm-build.ps1

SHELL ["cmd", "/S", "/C"]

ENTRYPOINT ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "C:\\lvpb\\vipm-build.ps1"]
