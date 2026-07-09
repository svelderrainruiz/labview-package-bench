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
  output?: string;
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
      runOptions.onOutput(options.output ?? 'build log line\n');
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
    expect(captured.errors[0]).toContain('not a .vipb, .pbs, or .nipb');
  });

  it('builds an NI package with NipbCli on the native provider', async () => {
    const { deps, captured } = makeHarness({ settings: nativeSettings, exitCode: 0 });
    const outcome = await runBuildPackage({ fsPath: 'C:\\w\\Solution.pbs' }, undefined, deps);
    expect(outcome).toEqual({ status: 'succeeded', exitCode: 0 });
    const invocation = captured.runInvocations[0];
    expect(invocation.command).toContain('NipbCli');
    expect(invocation.args).toEqual(['-o=C:\\w\\Solution.pbs', '-b=packages', '--save']);
    expect(captured.info.some((message) => message.includes('NI package build succeeded'))).toBe(
      true
    );
  });

  it('offers only the native provider for NI packages (docker lacks NI Package Builder)', async () => {
    let offered: BuildProvider[] = [];
    const { deps } = makeHarness({
      exitCode: 0,
      pick: (providers) => {
        offered = providers;
        return providers[0];
      }
    });
    await runBuildPackage({ fsPath: 'C:\\w\\Solution.pbs' }, undefined, deps);
    expect(offered.map((provider) => provider.id)).toEqual(['native-windows']);
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

  it('advises when a container provider is used for a build', async () => {
    const { deps, captured } = makeHarness({ pick: (providers) => providers[1], exitCode: 0 });
    await runBuildPackage({ fsPath: 'C:\\w\\a.vipb' }, undefined, deps);
    expect(
      captured.lines.some((line) => line.startsWith('Note:') && line.includes('preview'))
    ).toBe(true);
  });

  it('adds no build note for the verified native provider', async () => {
    const { deps, captured } = makeHarness({ settings: nativeSettings, exitCode: 0 });
    await runBuildPackage({ fsPath: 'C:\\w\\a.vipb' }, undefined, deps);
    expect(captured.lines.some((line) => line.startsWith('Note:'))).toBe(false);
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

  it('reports cancelled when the build signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const { deps, captured } = makeHarness({ settings: nativeSettings, exitCode: 0 });
    const outcome = await runBuildPackage(
      { fsPath: 'C:\\w\\a.vipb' },
      undefined,
      deps,
      controller.signal
    );
    expect(outcome).toEqual({ status: 'cancelled' });
    expect(captured.lines.some((line) => line.includes('cancelled'))).toBe(true);
  });

  it('explains a missing CLI (ENOENT) with an actionable message', async () => {
    const { deps, captured } = makeHarness({
      settings: nativeSettings,
      throwMessage: 'spawn vipm ENOENT'
    });
    const outcome = await runBuildPackage({ fsPath: 'C:\\w\\a.vipb' }, undefined, deps);
    expect(outcome.status).toBe('error');
    expect(captured.errors[0]).toMatch(/installed and on PATH/i);
  });

  it('explains a VIPM Community git-repository failure', async () => {
    const { deps, captured } = makeHarness({
      settings: nativeSettings,
      exitCode: 6,
      output: 'error: VIPM Community Edition requires a public Git repository.\n'
    });
    const outcome = await runBuildPackage({ fsPath: 'C:\\w\\a.vipb' }, undefined, deps);
    expect(outcome).toEqual({ status: 'failed', exitCode: 6 });
    expect(captured.errors[0]).toMatch(/public git repository/i);
  });

  it('still detects the git-repo hint at the end of a large build log', async () => {
    const { deps, captured } = makeHarness({
      settings: nativeSettings,
      exitCode: 6,
      output: `${'noise '.repeat(20000)}\nerror: requires a public Git repository.\n`
    });
    const outcome = await runBuildPackage({ fsPath: 'C:\\w\\a.vipb' }, undefined, deps);
    expect(outcome).toEqual({ status: 'failed', exitCode: 6 });
    expect(captured.errors[0]).toMatch(/public git repository/i);
  });
});
