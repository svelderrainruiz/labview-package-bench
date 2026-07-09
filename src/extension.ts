import * as vscode from 'vscode';

import { runBuildPackage, type BuildPackageDeps } from './commands/buildPackageCommand';
import { normalizePackageBenchSettings, type PackageBenchSettings } from './packaging/settings';
import { nodeProcessRunner } from './packaging/processRunner';
import { BUILD_OUTPUT_CHANNEL_NAME, createOutputChannelBuildLog } from './ui/buildOutputChannel';
import { pickBuildProvider } from './ui/providerPicker';

export const BUILD_PACKAGE_COMMAND_ID = 'labviewPackageBench.buildPackage';

function readSettings(): PackageBenchSettings {
  const config = vscode.workspace.getConfiguration('labviewPackageBench');
  return normalizePackageBenchSettings({
    defaultProvider: config.get('defaultProvider'),
    vipm: {
      cliPath: config.get('vipm.cliPath'),
      buildArgs: config.get('vipm.buildArgs')
    },
    docker: {
      image: config.get('docker.image'),
      containerWorkdir: config.get('docker.containerWorkdir')
    }
  });
}

export function activate(context: vscode.ExtensionContext): void {
  const channel = vscode.window.createOutputChannel(BUILD_OUTPUT_CHANNEL_NAME);
  context.subscriptions.push(channel);

  const deps: BuildPackageDeps = {
    readSettings,
    pickProvider: pickBuildProvider,
    runner: nodeProcessRunner,
    log: createOutputChannelBuildLog(channel),
    showInfo: (message) => {
      void vscode.window.showInformationMessage(message);
    },
    showError: (message) => {
      void vscode.window.showErrorMessage(message);
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(BUILD_PACKAGE_COMMAND_ID, (target: unknown) => {
      if (!vscode.workspace.isTrusted) {
        void vscode.window.showErrorMessage('Package builds require a trusted workspace.');
        return undefined;
      }
      const activeEditorPath = vscode.window.activeTextEditor?.document.uri.fsPath;
      return runBuildPackage(target, activeEditorPath, deps);
    })
  );
}

export function deactivate(): void {
  // No teardown required; disposables are registered on the extension context.
}
