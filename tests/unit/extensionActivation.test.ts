import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  registerCommandMock,
  commandHandlers,
  showInformationMessageMock,
  showErrorMessageMock,
  showQuickPickMock,
  outputChannels,
  workspaceState,
  editorState,
  configState
} = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const channels: Array<{ name: string; lines: string[] }> = [];
  return {
    registerCommandMock: vi.fn((command: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(command, handler);
      return { dispose: vi.fn() };
    }),
    commandHandlers: handlers,
    showInformationMessageMock: vi.fn(),
    showErrorMessageMock: vi.fn(),
    showQuickPickMock: vi.fn(),
    outputChannels: channels,
    workspaceState: { isTrusted: true },
    editorState: { active: undefined as { document: { uri: { fsPath: string } } } | undefined },
    configState: { values: {} as Record<string, unknown> }
  };
});

vi.mock('vscode', () => ({
  commands: {
    registerCommand: registerCommandMock
  },
  Uri: {
    file: (fsPath: string) => ({ fsPath, scheme: 'file' })
  },
  ProgressLocation: { SourceControl: 1, Window: 10, Notification: 15 },
  window: {
    createOutputChannel: (name: string) => {
      const channel = {
        name,
        lines: [] as string[],
        append: (text: string) => channel.lines.push(text),
        appendLine: (text: string) => channel.lines.push(text),
        clear: () => {
          channel.lines.length = 0;
        },
        show: () => undefined,
        hide: () => undefined,
        dispose: () => undefined
      };
      outputChannels.push(channel);
      return channel;
    },
    showInformationMessage: showInformationMessageMock,
    showErrorMessage: showErrorMessageMock,
    showQuickPick: showQuickPickMock,
    withProgress: (
      _options: unknown,
      task: (
        progress: { report: (value: unknown) => void },
        token: {
          isCancellationRequested: boolean;
          onCancellationRequested: () => { dispose: () => void };
        }
      ) => unknown
    ) =>
      task(
        { report: () => undefined },
        {
          isCancellationRequested: false,
          onCancellationRequested: () => ({ dispose: () => undefined })
        }
      ),
    get activeTextEditor() {
      return editorState.active;
    }
  },
  workspace: {
    get isTrusted() {
      return workspaceState.isTrusted;
    },
    getConfiguration: () => ({
      get: (key: string) => configState.values[key]
    }),
    getWorkspaceFolder: () => undefined
  }
}));

import { activate, BUILD_PACKAGE_COMMAND_ID } from '../../src/extension';
import type { CommandInvocation } from '../../src/packaging/vipmCliBuild';
import type { ProcessRunner } from '../../src/packaging/processRunner';

type ActivateContext = Parameters<typeof activate>[0];

function createContext() {
  return { subscriptions: [] as Array<{ dispose: () => void }> };
}

function invokeCommand(target?: unknown) {
  const handler = commandHandlers.get(BUILD_PACKAGE_COMMAND_ID);
  if (!handler) {
    throw new Error('build command not registered');
  }
  return handler(target);
}

describe('extension activation', () => {
  beforeEach(() => {
    commandHandlers.clear();
    outputChannels.length = 0;
    showInformationMessageMock.mockReset();
    showErrorMessageMock.mockReset();
    showQuickPickMock.mockReset();
    workspaceState.isTrusted = true;
    editorState.active = undefined;
    configState.values = {};
  });

  it('registers the build command and an output channel', () => {
    const context = createContext();
    activate(context as ActivateContext, { runner: { run: vi.fn(async () => 0) } });

    expect(registerCommandMock).toHaveBeenCalledWith(
      BUILD_PACKAGE_COMMAND_ID,
      expect.any(Function)
    );
    expect(context.subscriptions.length).toBeGreaterThanOrEqual(2);
    expect(outputChannels).toHaveLength(1);
  });

  it('blocks the build in an untrusted workspace', async () => {
    workspaceState.isTrusted = false;
    const run = vi.fn(async () => 0);
    activate(createContext() as ActivateContext, { runner: { run } });

    await invokeCommand({ fsPath: '/repo/src/lib.vipb' });

    expect(showErrorMessageMock).toHaveBeenCalledWith(expect.stringContaining('trusted'));
    expect(run).not.toHaveBeenCalled();
  });

  it('builds via the configured docker-linux provider when trusted', async () => {
    const invocations: CommandInvocation[] = [];
    const run = vi.fn(async (invocation: CommandInvocation) => {
      invocations.push(invocation);
      return 0;
    });
    const runner: ProcessRunner = { run };
    configState.values = { defaultProvider: 'docker-linux' };

    activate(createContext() as ActivateContext, { runner });
    await invokeCommand({ fsPath: '/repo/src/lib.vipb' });

    expect(run).toHaveBeenCalledTimes(1);
    expect(invocations[0].command).toBe('docker');
    expect(invocations[0].args).toContain('lvpb-vipm-build');
    expect(invocations[0].args).toContain('build');
    expect(showInformationMessageMock).toHaveBeenCalledWith(expect.stringContaining('succeeded'));
    expect(outputChannels[0].lines.join('\n')).toContain('Building lib.vipb');
  });
});
