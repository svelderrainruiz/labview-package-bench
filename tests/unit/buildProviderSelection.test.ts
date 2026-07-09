import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, normalizePackageBenchSettings } from '../../src/packaging/settings';
import { buildVipmInvocation } from '../../src/packaging/vipmCliBuild';
import { getBuildProviders, resolveConfiguredProvider } from '../../src/providers/registry';

const settings = DEFAULT_SETTINGS;

function baseFor(specPath: string) {
  return buildVipmInvocation({ specPath, labviewVersion: '2026', labviewBitness: '64' }, settings.vipm);
}

describe('build providers', () => {
  it('exposes native, docker-windows, and docker-linux providers in order', () => {
    expect(getBuildProviders(settings).map((provider) => provider.id)).toEqual([
      'native-windows',
      'docker-windows',
      'docker-linux'
    ]);
  });

  it('runs the base invocation unchanged on the native host', () => {
    const [native] = getBuildProviders(settings);
    const base = baseFor('C:\\repo\\src\\a.vipb');
    expect(
      native.resolveInvocation({
        specPath: 'C:\\repo\\src\\a.vipb',
        specDir: 'C:\\repo\\src',
        mountRoot: 'C:\\repo',
        base
      })
    ).toEqual(base);
  });

  it('mounts the repo root in a Windows docker run and rewrites the spec path', () => {
    const docker = getBuildProviders(settings)[1];
    const base = baseFor('C:\\repo\\src\\a.vipb');
    const invocation = docker.resolveInvocation({
      specPath: 'C:\\repo\\src\\a.vipb',
      specDir: 'C:\\repo\\src',
      mountRoot: 'C:\\repo',
      base
    });

    expect(invocation.command).toBe('docker');
    expect(invocation.args).toEqual([
      'run',
      '--rm',
      '-v',
      'C:\\repo:C:\\work',
      '-w',
      'C:\\work',
      'labview-package-bench-windows:latest',
      'vipm',
      'build',
      'C:\\work\\src\\a.vipb',
      '--labview-version',
      '2026',
      '--labview-bitness',
      '64',
      '--show-progress',
      '--verbose'
    ]);
  });

  it('mounts the repo root in a Linux docker run against the NI image', () => {
    const dockerLinux = getBuildProviders(settings)[2];
    const base = baseFor('/home/u/repo/src/a.vipb');
    const invocation = dockerLinux.resolveInvocation({
      specPath: '/home/u/repo/src/a.vipb',
      specDir: '/home/u/repo/src',
      mountRoot: '/home/u/repo',
      base
    });

    expect(invocation.command).toBe('docker');
    expect(invocation.args).toEqual([
      'run',
      '--rm',
      '-v',
      '/home/u/repo:/work',
      '-w',
      '/work',
      'labview-package-bench-linux:latest',
      'lvpb-vipm-build',
      'build',
      '/work/src/a.vipb',
      '--labview-version',
      '2026',
      '--labview-bitness',
      '64',
      '--show-progress',
      '--verbose'
    ]);
  });

  it('resolves a configured provider and defers when set to ask', () => {
    const providers = getBuildProviders(settings);
    expect(
      resolveConfiguredProvider(
        normalizePackageBenchSettings({ defaultProvider: 'docker-linux' }),
        providers
      )?.id
    ).toBe('docker-linux');
    expect(
      resolveConfiguredProvider(normalizePackageBenchSettings({ defaultProvider: 'ask' }), providers)
    ).toBeUndefined();
  });
});
