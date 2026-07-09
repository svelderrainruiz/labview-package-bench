import type * as vscode from 'vscode';

export const BUILD_OUTPUT_CHANNEL_NAME = 'LabVIEW Package Bench';

/**
 * Minimal logging surface used by the build command. Backed by a VS Code
 * `OutputChannel` at runtime and by a fake in unit tests.
 */
export interface BuildLog {
  append(text: string): void;
  appendLine(text: string): void;
  clear(): void;
  show(): void;
}

export function createOutputChannelBuildLog(channel: vscode.OutputChannel): BuildLog {
  return {
    append: (text) => channel.append(text),
    appendLine: (text) => channel.appendLine(text),
    clear: () => channel.clear(),
    show: () => channel.show(true)
  };
}
