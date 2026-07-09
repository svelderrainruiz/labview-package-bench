import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

import { runBuildPackage, extractSpecPath, type BuildPackageDeps } from './commands/buildPackageCommand';
import { baseName } from './packaging/pathUtil';
import { normalizePackageBenchSettings, type PackageBenchSettings } from './packaging/settings';
import { nodeProcessRunner } from './packaging/processRunner';
import { BUILD_OUTPUT_CHANNEL_NAME, createOutputChannelBuildLog } from './ui/buildOutputChannel';
import { pickBuildProvider } from './ui/providerPicker';

export const BUILD_PACKAGE_COMMAND_ID = 'labviewPackageBench.buildPackage';

function readSettings(): PackageBenchSettings {
  const config = vscode.workspace.getConfiguration('labviewPackageBench');
  return normalizePackageBenchSettings({
    defaultProvider: config.get('defaultProvider'),
    labview: {
      version: config.get('labview.version'),
      bitness: config.get('labview.bitness')
    },
    vipm: {
      cliPath: config.get('vipm.cliPath'),
      buildArgs: config.get('vipm.buildArgs')
    },
    docker: {
      image: config.get('docker.image'),
      containerWorkdir: config.get('docker.containerWorkdir'),
      dns: config.get('docker.dns')
    },
    linuxContainer: {
      image: config.get('linuxContainer.image'),
      cacheVolume: config.get('linuxContainer.cacheVolume')
    }
  });
}

function resolveMountRoot(specPath: string): string {
  // VIPM Community Edition requires the working directory to sit inside a public
  // git repo, so bind-mount the nearest ancestor that contains a `.git` entry.
  let current = path.dirname(specPath);
  let previous = '';
  while (current && current !== previous) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    previous = current;
    current = path.dirname(current);
  }

  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(specPath));
  return folder?.uri.fsPath ?? path.dirname(specPath);
}

export function activate(
  context: vscode.ExtensionContext,
  depsOverrides: Partial<BuildPackageDeps> = {}
): void {
  const channel = vscode.window.createOutputChannel(BUILD_OUTPUT_CHANNEL_NAME);
  context.subscriptions.push(channel);

  const deps: BuildPackageDeps = {
    readSettings,
    resolveMountRoot,
    pickProvider: pickBuildProvider,
    runner: nodeProcessRunner,
    log: createOutputChannelBuildLog(channel),
    showInfo: (message) => {
      void vscode.window.showInformationMessage(message);
    },
    showError: (message) => {
      void vscode.window.showErrorMessage(message);
    },
    ...depsOverrides
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(BUILD_PACKAGE_COMMAND_ID, (target: unknown) => {
      if (!vscode.workspace.isTrusted) {
        void vscode.window.showErrorMessage('Package builds require a trusted workspace.');
        return undefined;
      }
      const activeEditorPath = vscode.window.activeTextEditor?.document.uri.fsPath;
      const specPath = extractSpecPath(target, activeEditorPath);
      const title = specPath ? `Building ${baseName(specPath)}\u2026` : 'Building package\u2026';
      return vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title,
          cancellable: true
        },
        (_progress, token) => {
          const controller = new AbortController();
          token.onCancellationRequested(() => controller.abort());
          return runBuildPackage(target, activeEditorPath, deps, controller.signal);
        }
      );
    })
  );
}

export function deactivate(): void {
  // No teardown required; disposables are registered on the extension context.
}
