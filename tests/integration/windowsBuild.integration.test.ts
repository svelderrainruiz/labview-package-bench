import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { planBuildInvocation } from '../../src/commands/buildPackageCommand';
import { nodeProcessRunner } from '../../src/packaging/processRunner';
import { normalizePackageBenchSettings } from '../../src/packaging/settings';
import { getBuildProviders } from '../../src/providers/registry';

/**
 * End-to-end build of a `.vipb` through the real provider invocation + process
 * runner, asserting a `.vip` lands on disk. This is the repeatable, codified
 * version of the manual native-windows / docker-windows verification.
 *
 * Opt in by setting environment variables (skipped otherwise so CI stays green):
 *   LVPB_INTEGRATION=1                 enable this suite
 *   LVPB_SPEC=<abs path to Foo.vipb>   the build spec to build
 *   LVPB_PROVIDER=native-windows|docker-windows|docker-linux  (default native-windows)
 *   LVPB_LABVIEW_VERSION=2026          (optional, default 2026)
 *   LVPB_LABVIEW_BITNESS=64            (optional, default 64)
 *   LVPB_DOCKER_DNS=8.8.8.8            (optional, docker-windows DNS)
 *
 * VIPM Pro activation for docker-windows is supplied by forwarding the
 * VIPM_SERIAL_NUMBER / VIPM_FULL_NAME / VIPM_EMAIL host environment variables.
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

function listVips(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.toLowerCase().endsWith('.vip')) found.push(full);
    }
  };
  walk(root);
  return found;
}

suite('VI package build (integration)', () => {
  const specPath = process.env.LVPB_SPEC;
  const providerId = process.env.LVPB_PROVIDER ?? 'native-windows';

  it(`produces a .vip via ${providerId}`, async () => {
    if (!specPath) {
      throw new Error('Set LVPB_SPEC to the absolute path of a named .vipb build spec.');
    }
    expect(fs.existsSync(specPath), `spec not found: ${specPath}`).toBe(true);

    const settings = normalizePackageBenchSettings({
      defaultProvider: providerId,
      labview: {
        version: process.env.LVPB_LABVIEW_VERSION ?? '2026',
        bitness: process.env.LVPB_LABVIEW_BITNESS ?? '64'
      },
      docker: { dns: process.env.LVPB_DOCKER_DNS ?? '' }
    });

    const provider = getBuildProviders(settings).find((candidate) => candidate.id === providerId);
    expect(provider, `unknown provider: ${providerId}`).toBeDefined();

    const mountRoot = findGitRoot(path.dirname(specPath)) ?? path.dirname(specPath);
    const plan = planBuildInvocation(specPath, mountRoot, provider!, settings);

    // Remove any prior build output so the run is repeatable (VIPM refuses to
    // overwrite an existing .vip).
    for (const vip of listVips(mountRoot)) {
      fs.rmSync(vip, { force: true });
    }

    let output = '';
    const exitCode = await nodeProcessRunner.run(plan.invocation, {
      cwd: plan.specDir,
      onOutput: (chunk) => {
        output += chunk;
      }
    });

    expect(output.length).toBeGreaterThan(0);
    expect(exitCode, `build failed:\n${output}`).toBe(0);
    expect(listVips(mountRoot).length, 'no .vip was produced').toBeGreaterThan(0);
  });
});
