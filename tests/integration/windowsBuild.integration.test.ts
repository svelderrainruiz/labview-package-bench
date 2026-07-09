import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { planBuildInvocation } from '../../src/commands/buildPackageCommand';
import { detectPackageType } from '../../src/packaging/packageBuildRequest';
import { nodeProcessRunner } from '../../src/packaging/processRunner';
import { normalizePackageBenchSettings } from '../../src/packaging/settings';
import { getBuildProviders } from '../../src/providers/registry';

/**
 * End-to-end build of a `.vipb` (VI package) or `.pbs` (NI Package Builder
 * solution) through the real provider invocation + process runner, asserting
 * the artifact — a `.vip` or `.nipkg` — lands on disk. This is the repeatable,
 * codified version of the manual native-windows / docker verification.
 *
 * Opt in by setting environment variables (skipped otherwise so CI stays green):
 *   LVPB_INTEGRATION=1                 enable this suite
 *   LVPB_SPEC=<abs path to Foo.vipb | Solution.pbs>   the build spec to build
 *   LVPB_PROVIDER=native-windows|docker-windows|docker-linux  (default native-windows)
 *   LVPB_LABVIEW_VERSION=2026          (optional, VI builds; default 2026)
 *   LVPB_LABVIEW_BITNESS=64            (optional, VI builds; default 64)
 *   LVPB_DOCKER_DNS=8.8.8.8            (optional, docker-windows DNS)
 *   LVPB_NIPB_CLI=<path to NipbCli.exe>  (optional, NI builds; overrides default)
 *
 * NI packages build from a `.pbs` solution via NipbCli and require the
 * native-windows provider (NI Package Builder is Windows-only). VIPM Pro
 * activation for docker-windows is supplied via VIPM_SERIAL_NUMBER /
 * VIPM_FULL_NAME / VIPM_EMAIL host environment variables.
 */

const ENABLED = process.env.LVPB_INTEGRATION === '1';
const suite = ENABLED ? describe : describe.skip;

function findGitRoot(startDir: string): string | undefined {
  let current = startDir;
  let previous = '';
  while (current && current !== previous) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    previous = current;
    current = path.dirname(current);
  }
  return undefined;
}

function listArtifacts(root: string, ext: string): string[] {
  const suffix = ext.toLowerCase();
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.toLowerCase().endsWith(suffix)) found.push(full);
    }
  };
  walk(root);
  return found;
}

suite('package build (integration)', () => {
  const specPath = process.env.LVPB_SPEC;
  const providerId = process.env.LVPB_PROVIDER ?? 'native-windows';
  const packageType = specPath ? detectPackageType(specPath) : 'unknown';
  const artifactExt = packageType === 'ni' ? '.nipkg' : '.vip';

  it(`produces a ${artifactExt} via ${providerId}`, async () => {
    if (!specPath) {
      throw new Error('Set LVPB_SPEC to the absolute path of a .vipb or .pbs build spec.');
    }
    expect(fs.existsSync(specPath), `spec not found: ${specPath}`).toBe(true);
    expect(packageType, `unsupported spec: ${specPath}`).not.toBe('unknown');

    const settings = normalizePackageBenchSettings({
      defaultProvider: providerId,
      labview: {
        version: process.env.LVPB_LABVIEW_VERSION ?? '2026',
        bitness: process.env.LVPB_LABVIEW_BITNESS ?? '64'
      },
      docker: { dns: process.env.LVPB_DOCKER_DNS ?? '' },
      nipb: process.env.LVPB_NIPB_CLI ? { cliPath: process.env.LVPB_NIPB_CLI } : undefined
    });

    const provider = getBuildProviders(settings).find((candidate) => candidate.id === providerId);
    expect(provider, `unknown provider: ${providerId}`).toBeDefined();
    expect(
      provider!.supportedPackageTypes.includes(packageType),
      `${providerId} cannot build ${packageType} packages`
    ).toBe(true);

    const mountRoot = findGitRoot(path.dirname(specPath)) ?? path.dirname(specPath);
    const plan = planBuildInvocation(specPath, mountRoot, provider!, settings);

    // Do NOT delete pre-existing artifacts: a repo may hold checked-in packages
    // or local-feed inputs (a `.nipkg` can be a build input, not just an output),
    // and this opt-in harness must never remove them. Instead, snapshot each
    // existing artifact's mtime and assert a *freshly* produced one — new by
    // path, or rebuilt (its own mtime advanced). Comparing each file's post-run
    // mtime against its own pre-run mtime (same filesystem) avoids wall-clock
    // resolution/skew issues.
    const before = new Map(
      listArtifacts(mountRoot, artifactExt).map(
        (artifact): [string, number] => [artifact, fs.statSync(artifact).mtimeMs]
      )
    );

    let output = '';
    const exitCode = await nodeProcessRunner.run(plan.invocation, {
      cwd: plan.specDir,
      onOutput: (chunk) => {
        output += chunk;
      },
      env: plan.env
    });

    const produced = listArtifacts(mountRoot, artifactExt).filter((artifact) => {
      const priorMtime = before.get(artifact);
      return priorMtime === undefined || fs.statSync(artifact).mtimeMs > priorMtime;
    });

    expect(output.length).toBeGreaterThan(0);
    expect(exitCode, `build failed:\n${output}`).toBe(0);
    expect(produced.length, `no freshly built ${artifactExt} was produced`).toBeGreaterThan(0);
  });
});
