import { describe, expect, it, vi } from 'vitest';

import {
  extractSpecPath,
  planBuildInvocation,
  runBuildPackage,
  type BuildPackageDeps
} from '../../src/commands/buildPackageCommand';
import type { BuildProvider } from '../../src/packaging/buildProvider';
import type { ProcessRunner } from '../../src/packaging/processRunner';
import {
  DEFAULT_SETTINGS,
  normalizePackageBenchSettings,
  type PackageBenchSettings
} from '../../src/packaging/settings';
import type { CommandInvocation } from '../../src/packaging/vipmCliBuild';
import { getBuildProviders } from '../../src/providers/registry';

interface HarnessOptions {
  settings?: PackageBenchSettings;
  exitCode?: number;
  throwMessage?: string;
  pick?: (providers: BuildProvider[]) => BuildProvider | undefined;
}

function makeHarness(options: HarnessOptions = {}) {
  const settings = options.settings ?? DEFAULT_SETTINGS;
  const captured = {
    lines: [] as string[],
    info: [] as string[],
    errors: [] as string[],
    runInvocations: [] as CommandInvocation[],
    cleared: 0,
    shown: 0
  };

  const runner: ProcessRunner = {
    run: vi.fn(async (invocation: CommandInvocation, runOptions) => {
      captured.runInvocations.push(invocation);
      runOptions.onOutput('build log line\n');
      if (options.throwMessage) {
        throw new Error(options.throwMessage);
      }
      return options.exitCode ?? 0;
    })
  };

  const pickProvider = vi.fn(async (providers: BuildProvider[]) =>
    options.pick ? options.pick(providers) : undefined
  );

  const deps: BuildPackageDeps = {
    readSettings: () => settings,
    resolveMountRoot: (specPath: string) => specPath.replace(/[\\/][^\\/]*$/, ''),
    pickProvider,
    runner,
    log: {
      append: (text) => captured.lines.push(text),
      appendLine: (text) => captured.lines.push(text),
      clear: () => {
        captured.cleared += 1;
      },
      show: () => {
        captured.shown += 1;
      }
    },
    showInfo: (message) => captured.info.push(message),
    showError: (message) => captured.errors.push(message)
  };

  return { deps, captured, runner, pickProvider };
}

const nativeSettings = normalizePackageBenchSettings({ defaultProvider: 'native-windows' });

describe('extractSpecPath', () => {
  it('prefers a context-menu URI target over the active editor', () => {
    expect(extractSpecPath({ fsPath: '/x/a.vipb' }, '/y/b.vipb')).toBe('/x/a.vipb');
  });

  it('falls back to the active editor path when there is no target', () => {
    expect(extractSpecPath(undefined, '/y/b.vipb')).toBe('/y/b.vipb');
    expect(extractSpecPath(undefined, undefined)).toBeUndefined();
  });
});

describe('planBuildInvocation', () => {
  it('plans a native build that runs the base invocation', () => {
    const [native] = getBuildProviders(DEFAULT_SETTINGS);
    const plan = planBuildInvocation('C:\\w\\a.vipb', 'C:\\w', native, DEFAULT_SETTINGS);
    expect(plan.specDir).toBe('C:\\w');
    expect(plan.invocation).toEqual({
      command: 'vipm',
      args: [
        'build',
        'C:\\w\\a.vipb',
        '--labview-version',
        '2026',
        '--labview-bitness',
        '64',
        '--show-progress',
        '--verbose'
      ]
    });
  });
});

describe('runBuildPackage', () => {
  it('reports no-target when nothing is selected', async () => {
    const { deps, captured } = makeHarness();
    expect(await runBuildPackage(undefined, undefined, deps)).toEqual({ status: 'no-target' });
    expect(captured.errors).toHaveLength(1);
  });

  it('rejects unsupported file types', async () => {
    const { deps, captured } = makeHarness();
    expect(await runBuildPackage({ fsPath: '/x/y.vi' }, undefined, deps)).toEqual({
      status: 'unsupported'
    });
    expect(captured.errors[0]).toContain('not a .vipb or .nipb');
  });

  it('defers NI package builds', async () => {
    const { deps, captured } = makeHarness();
    expect(await runBuildPackage({ fsPath: '/x/y.nipb' }, undefined, deps)).toEqual({
      status: 'deferred'
    });
    expect(captured.info[0]).toContain('NI package');
  });

  it('cancels when the provider picker is dismissed', async () => {
    const { deps, runner } = makeHarness();
    expect(await runBuildPackage({ fsPath: '/x/y.vipb' }, undefined, deps)).toEqual({
      status: 'cancelled'
    });
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('builds a VI package on the configured native provider', async () => {
    const { deps, captured } = makeHarness({ settings: nativeSettings, exitCode: 0 });
    const outcome = await runBuildPackage({ fsPath: 'C:\\w\\a.vipb' }, undefined, deps);
    expect(outcome).toEqual({ status: 'succeeded', exitCode: 0 });
    expect(captured.runInvocations[0].command).toBe('vipm');
    expect(captured.cleared).toBe(1);
    expect(captured.shown).toBe(1);
    expect(captured.info.some((message) => message.includes('succeeded'))).toBe(true);
  });

  it('routes through the docker provider when picked', async () => {
    const { deps, captured } = makeHarness({ pick: (providers) => providers[1], exitCode: 0 });
    await runBuildPackage({ fsPath: 'C:\\w\\a.vipb' }, undefined, deps);
    expect(captured.runInvocations[0].command).toBe('docker');
  });

  it('reports a failing exit code', async () => {
    const { deps, captured } = makeHarness({ settings: nativeSettings, exitCode: 2 });
    expect(await runBuildPackage({ fsPath: 'C:\\w\\a.vipb' }, undefined, deps)).toEqual({
      status: 'failed',
      exitCode: 2
    });
    expect(captured.errors[0]).toContain('exit code 2');
  });

  it('reports runner errors', async () => {
    const { deps, captured } = makeHarness({ settings: nativeSettings, throwMessage: 'boom' });
    expect(await runBuildPackage({ fsPath: 'C:\\w\\a.vipb' }, undefined, deps)).toEqual({
      status: 'error',
      message: 'boom'
    });
    expect(captured.errors[0]).toContain('boom');
  });
});
