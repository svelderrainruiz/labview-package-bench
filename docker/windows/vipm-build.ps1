<#
.SYNOPSIS
    Baked VI-package build wrapper for the LabVIEW Windows container.

.DESCRIPTION
    One-shot containers are not pre-activated, their VIPM package cache is empty,
    and LabVIEW is cold. Before running the requested build this wrapper:

      1. Activates VIPM Pro when VIPM_SERIAL_NUMBER is provided (activation is
         required to use VIPM inside a container today). The serial, name, and
         email are read from the environment so they never appear on a command
         line or in the image.
      2. Refreshes package sources so VIPM registers the installed LabVIEW and
         resolves dependencies (mirrors the Linux container's `vipm refresh`).
      3. Warms LabVIEW: a cold LabVIEW launch on Windows Server Core can exceed
         VIPM's fixed 120 s launch timeout, so it starts the requested LabVIEW
         headless and waits for its VI Server port. VIPM then connects to the
         already-running instance instead of launching it (and timing out).
      4. Runs the passed vipm command (e.g.
         `build <spec> --labview-version 2026 --labview-bitness 64 ...`) and
         propagates its exit code.
#>
$ErrorActionPreference = 'Stop'

function Invoke-Vipm {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]] $VipmArgs)
    & vipm @VipmArgs
    if ($LASTEXITCODE -ne 0) {
        throw "vipm $($VipmArgs -join ' ') failed with exit code $LASTEXITCODE"
    }
}

# Resolve the LabVIEW the build targets from the forwarded --labview-version /
# --labview-bitness args (falling back to the image's LV_YEAR and 64-bit).
$year = if ($env:LV_YEAR) { $env:LV_YEAR } else { '2026' }
$bitness = '64'
for ($i = 0; $i -lt $args.Count - 1; $i++) {
    switch ($args[$i]) {
        '--labview-version' { $year = $args[$i + 1] }
        '--labview-bitness' { $bitness = $args[$i + 1] }
    }
}
$lvDir = if ($bitness -eq '32') {
    "C:\Program Files (x86)\National Instruments\LabVIEW $year"
} else {
    "C:\Program Files\National Instruments\LabVIEW $year"
}
$lvExe = Join-Path $lvDir 'LabVIEW.exe'
$lvIni = Join-Path $lvDir 'LabVIEW.ini'

# VI Server TCP port LabVIEW listens on (VIPM connects here); read from the ini.
$port = 3363
if (Test-Path $lvIni) {
    $match = Select-String -Path $lvIni -Pattern '^server\.tcp\.port=(\d+)' | Select-Object -First 1
    if ($match) { $port = [int]$match.Matches[0].Groups[1].Value }
}

if ($env:VIPM_SERIAL_NUMBER) {
    Invoke-Vipm activate --serial-number $env:VIPM_SERIAL_NUMBER --name $env:VIPM_FULL_NAME --email $env:VIPM_EMAIL
}

Invoke-Vipm refresh

if (Test-Path $lvExe) {
    Write-Output "Warming LabVIEW $year ($bitness-bit) headless; waiting for VI Server on port $port..."
    Start-Process -FilePath $lvExe -ArgumentList '--headless' | Out-Null
    $deadline = (Get-Date).AddSeconds(600)
    $ready = $false
    while (-not $ready -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 5
        $ready = Test-NetConnection -ComputerName 'localhost' -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
    }
    Write-Output "LabVIEW VI Server ready: $ready"
}

# Run the requested build and surface its exit code as the container's exit code.
& vipm @args
exit $LASTEXITCODE
