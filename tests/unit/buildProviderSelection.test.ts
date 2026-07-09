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
      '-e',
      'VIPM_SERIAL_NUMBER',
      '-e',
      'VIPM_FULL_NAME',
      '-e',
      'VIPM_EMAIL',
      '-v',
      'C:\\repo:C:\\work',
      '-w',
      'C:\\work',
      'labview-package-bench-windows:latest',
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

  it('forwards VIPM Pro activation env by name only, never by value', () => {
    const docker = getBuildProviders(settings)[1];
    const base = baseFor('C:\\repo\\src\\a.vipb');
    const invocation = docker.resolveInvocation({
      specPath: 'C:\\repo\\src\\a.vipb',
      specDir: 'C:\\repo\\src',
      mountRoot: 'C:\\repo',
      base
    });

    // Only the env variable *names* are passed so `docker run` forwards them
    // from the host — a serial value must never be embedded in the invocation.
    expect(invocation.args).toContain('VIPM_SERIAL_NUMBER');
    const serialIndex = invocation.args.indexOf('VIPM_SERIAL_NUMBER');
    expect(invocation.args[serialIndex - 1]).toBe('-e');
    // The token after the image is the vipm sub-command (the baked entrypoint
    // prepends `vipm`), not an explicit command or secret.
    expect(invocation.args).not.toContain('vipm');
  });

  it('adds an explicit DNS server to the Windows docker run when configured', () => {
    const withDns = normalizePackageBenchSettings({ docker: { dns: '8.8.8.8' } });
    const docker = getBuildProviders(withDns)[1];
    const base = baseFor('C:\\repo\\src\\a.vipb');
    const invocation = docker.resolveInvocation({
      specPath: 'C:\\repo\\src\\a.vipb',
      specDir: 'C:\\repo\\src',
      mountRoot: 'C:\\repo',
      base
    });

    expect(invocation.args.slice(0, 4)).toEqual(['run', '--rm', '--dns', '8.8.8.8']);
  });

  it('omits --dns when no DNS is configured', () => {
    const docker = getBuildProviders(settings)[1];
    const base = baseFor('C:\\repo\\src\\a.vipb');
    const invocation = docker.resolveInvocation({
      specPath: 'C:\\repo\\src\\a.vipb',
      specDir: 'C:\\repo\\src',
      mountRoot: 'C:\\repo',
      base
    });

    expect(invocation.args).not.toContain('--dns');
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
      '-v',
      'labview-package-bench-vipm-cache:/usr/local/jki/vipm/cache',
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

  it('omits the cache volume when disabled', () => {
    const noCache = normalizePackageBenchSettings({ linuxContainer: { cacheVolume: '' } });
    const dockerLinux = getBuildProviders(noCache)[2];
    const base = baseFor('/home/u/repo/src/a.vipb');
    const invocation = dockerLinux.resolveInvocation({
      specPath: '/home/u/repo/src/a.vipb',
      specDir: '/home/u/repo/src',
      mountRoot: '/home/u/repo',
      base
    });

    expect(invocation.args).not.toContain(
      'labview-package-bench-vipm-cache:/usr/local/jki/vipm/cache'
    );
    expect(invocation.args.filter((arg) => arg === '-v')).toHaveLength(1);
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
