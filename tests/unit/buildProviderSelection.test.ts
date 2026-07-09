import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, normalizePackageBenchSettings } from '../../src/packaging/settings';
import { buildVipmInvocation } from '../../src/packaging/vipmCliBuild';
import { getBuildProviders, resolveConfiguredProvider } from '../../src/providers/registry';

const settings = DEFAULT_SETTINGS;

describe('build providers', () => {
  it('exposes the native and docker Windows providers in order', () => {
    expect(getBuildProviders(settings).map((provider) => provider.id)).toEqual([
      'native-windows',
      'docker-windows'
    ]);
  });

  it('runs the base invocation unchanged on the native host', () => {
    const [native] = getBuildProviders(settings);
    const base = buildVipmInvocation('C:\\w\\a.vipb', settings.vipm);
    expect(native.resolveInvocation({ specPath: 'C:\\w\\a.vipb', specDir: 'C:\\w', base })).toEqual(
      base
    );
  });

  it('wraps the invocation in docker run and rewrites the spec path into the container', () => {
    const docker = getBuildProviders(settings)[1];
    const base = buildVipmInvocation('C:\\w\\a.vipb', settings.vipm);
    const invocation = docker.resolveInvocation({
      specPath: 'C:\\w\\a.vipb',
      specDir: 'C:\\w',
      base
    });

    expect(invocation.command).toBe('docker');
    expect(invocation.args).toEqual([
      'run',
      '--rm',
      '-v',
      'C:\\w:C:\\work',
      '-w',
      'C:\\work',
      'labview-package-bench-windows:latest',
      'vipm',
      'build',
      'C:\\work\\a.vipb'
    ]);
  });

  it('resolves a configured provider and defers when set to ask', () => {
    const providers = getBuildProviders(settings);
    expect(
      resolveConfiguredProvider(
        normalizePackageBenchSettings({ defaultProvider: 'docker-windows' }),
        providers
      )?.id
    ).toBe('docker-windows');
    expect(
      resolveConfiguredProvider(normalizePackageBenchSettings({ defaultProvider: 'ask' }), providers)
    ).toBeUndefined();
  });
});
