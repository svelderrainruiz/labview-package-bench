import * as vscode from 'vscode';

import type { BuildProvider } from '../packaging/buildProvider';

/**
 * Prompts the user to choose a build environment. Returns `undefined` when the
 * picker is dismissed.
 */
export async function pickBuildProvider(
  providers: BuildProvider[]
): Promise<BuildProvider | undefined> {
  const items = providers.map((provider) => ({
    label: provider.label,
    description: provider.id,
    detail: provider.description,
    provider
  }));

  const selection = await vscode.window.showQuickPick(items, {
    title: 'Build Package',
    placeHolder: 'Select the environment to build in'
  });

  return selection?.provider;
}
